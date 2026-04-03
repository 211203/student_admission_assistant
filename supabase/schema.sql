-- =============================================
-- Student Admission Assistant Portal - Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- STUDENT PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ADMIN PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  department TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- APPLICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_course TEXT NOT NULL,
  academic_background TEXT,
  entrance_exam_score NUMERIC,
  preferred_intake_year TEXT,
  budget_range TEXT,
  questions TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DOCUMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    '10th_marksheet', '12th_marksheet', 'leaving_certificate',
    'mht_cet_scorecard', 'jee_scorecard',
    'id_proof', 'photo',
    'caste_certificate', 'income_certificate',
    'gap_certificate'
  )),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COUNSELING SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.counseling_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  student_name TEXT,
  student_email TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CHAT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counseling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Student Profiles
CREATE POLICY "Students can view own profile" ON public.student_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Students can update own profile" ON public.student_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Students can insert own profile" ON public.student_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all student profiles" ON public.student_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);

-- Admin Profiles
CREATE POLICY "Admins can view own profile" ON public.admin_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can update own profile" ON public.admin_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can insert own profile" ON public.admin_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Applications
CREATE POLICY "Students can view own applications" ON public.applications FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can insert own applications" ON public.applications FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Admins can view all applications" ON public.applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins can update all applications" ON public.applications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);

-- Documents
CREATE POLICY "Students can view own documents" ON public.documents FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can insert own documents" ON public.documents FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students can delete own documents" ON public.documents FOR DELETE USING (student_id = auth.uid());
CREATE POLICY "Admins can view all documents" ON public.documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);

-- Counseling
CREATE POLICY "Students can view own sessions" ON public.counseling_sessions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can insert own sessions" ON public.counseling_sessions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Admins can view all sessions" ON public.counseling_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins can update all sessions" ON public.counseling_sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);

-- Chat
CREATE POLICY "Students can view own messages" ON public.chat_messages FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (student_id = auth.uid());

-- Notifications
CREATE POLICY "Students can view own notifications" ON public.notifications FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Students can mark notifications read" ON public.notifications FOR UPDATE USING (student_id = auth.uid());
CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);

-- =============================================
-- TRIGGER: Auto-insert student profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create student profile if role is 'student' or not specified
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'student' THEN
    INSERT INTO public.student_profiles (id, full_name, email)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGER: Auto-insert admin profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create admin profile if role is 'admin'
  IF NEW.raw_user_meta_data->>'role' = 'admin' THEN
    INSERT INTO public.admin_profiles (id, full_name, email)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_student_created ON auth.users;
DROP TRIGGER IF EXISTS on_admin_created ON auth.users;

CREATE TRIGGER on_student_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_student();

CREATE TRIGGER on_admin_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin();

-- =============================================
-- FUNCTION: Update last_login_at on sign in
-- =============================================
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Update student profile last_login
  UPDATE public.student_profiles 
  SET last_login_at = NOW(), updated_at = NOW()
  WHERE id = NEW.id;
  
  -- Update admin profile last_login
  UPDATE public.admin_profiles 
  SET last_login_at = NOW(), updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STORAGE BUCKET + POLICIES
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Students can upload own documents" ON storage.objects;
CREATE POLICY "Students can upload own documents"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Students can view own documents" ON storage.objects;
CREATE POLICY "Students can view own documents"
ON storage.objects FOR SELECT USING (
  bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Students can delete own documents" ON storage.objects;
CREATE POLICY "Students can delete own documents"
ON storage.objects FOR DELETE USING (
  bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Students can update own documents" ON storage.objects;
CREATE POLICY "Students can update own documents"
ON storage.objects FOR UPDATE USING (
  bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT USING (
  bucket_id = 'student-documents' AND
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete all documents" ON storage.objects;
CREATE POLICY "Admins can delete all documents"
ON storage.objects FOR DELETE USING (
  bucket_id = 'student-documents' AND
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);
