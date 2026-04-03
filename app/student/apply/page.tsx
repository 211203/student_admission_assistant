'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { COURSES, ACADEMIC_STREAMS } from '@/lib/utils'
import { FileText, SendHorizonal, CheckCircle, Info } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  preferredCourse: z.string().min(1, 'Please select a course'),
  academicStream: z.string().min(1, 'Please select your academic stream'),
  preferredIntakeYear: z.string().min(1, 'Please select an intake year'),
  questions: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const INTAKE_YEARS = [
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
]


export default function ApplyPage() {
  const { profile } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile?.full_name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      academicStream: '',
    },
  })

  const selectedStream = watch('academicStream')

  const getRequiredExams = (stream: string) => {
    const examMap: Record<string, string[]> = {
      PCM: ['JEE', 'MHT-CET'],
      PCB: ['NEET', 'MHT-CET'],
      PCMB: ['JEE', 'NEET', 'MHT-CET'],
    }
    return examMap[stream] || []
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Please login first'); return }

      const payload = {
        student_id: user.id,
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        preferred_course: data.preferredCourse,
        academic_stream: data.academicStream,
        preferred_intake_year: data.preferredIntakeYear,
        questions: data.questions || '',
        status: 'pending',
      }

      // Save to Supabase
      const { error } = await supabase.from('applications').insert([payload])
      if (error) {
        console.error('[apply] Supabase insert error', {
          message: error.message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        })
        throw error
      }

      // Send to n8n webhook
      try {
        await fetch(process.env.NEXT_PUBLIC_N8N_ADMISSION_WEBHOOK!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
        })
      } catch {
        // webhook failure is non-blocking
      }

      setSubmitted(true)
      toast.success('Application submitted successfully!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="h-10 w-10 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-white">Application Submitted!</h1>
        <p className="text-slate-400">
          Your application has been received. Our admission team will review it and get back to you soon. You can track your status from the dashboard.
        </p>
        <Button onClick={() => setSubmitted(false)} variant="outline">Submit Another Application</Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center">
          <FileText className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Apply for Course</h1>
          <p className="text-slate-400 text-sm">Fill in the details below to submit your application</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Info */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-5">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Full Name *" placeholder="John Doe" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Email Address *" type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
            <Input label="Phone Number *" type="tel" placeholder="+91 9876543210" error={errors.phone?.message} {...register('phone')} />
            <Select
              label="Preferred Intake Year *"
              options={INTAKE_YEARS}
              error={errors.preferredIntakeYear?.message}
              {...register('preferredIntakeYear')}
            />
          </div>
        </Card>

        {/* Academic Info */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-5">Academic Information</h2>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select
                label="Academic Stream *"
                options={ACADEMIC_STREAMS}
                error={errors.academicStream?.message}
                {...register('academicStream')}
              />
              <Select
                label="Preferred Course *"
                options={COURSES.map(c => ({ value: c, label: c }))}
                error={errors.preferredCourse?.message}
                {...register('preferredCourse')}
              />
            </div>

            {selectedStream && (
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-400 font-medium">Required Entrance Exam Documents</p>
                  <p className="text-slate-300 mt-1">
                    Based on your {selectedStream} stream, you will need to upload:{' '}
                    <strong className="text-white">{getRequiredExams(selectedStream).join(', ')}</strong> scorecards in the Documents section after submitting this application.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Questions */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-5">Additional Questions</h2>
          <Textarea
            label="Any questions or notes for the admission team?"
            placeholder="Feel free to ask any questions about the course, fees, scholarships, etc..."
            rows={4}
            {...register('questions')}
          />
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" loading={loading} size="lg" className="gap-2">
            <SendHorizonal className="h-4 w-4" />
            Submit Application
          </Button>
        </div>
      </form>
    </div>
  )
}
