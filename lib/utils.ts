import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  reviewing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  scheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export const COURSES = [
  'Computer Science Engineering',
  'Data Science & AI',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Business Administration (MBA)',
  'Medical Sciences (MBBS)',
  'Law (LLB)',
  'Design & Architecture',
  'Biotechnology',
]

export const ACADEMIC_STREAMS = [
  { value: 'PCM', label: 'PCM (Physics, Chemistry, Mathematics)' },
  { value: 'PCB', label: 'PCB (Physics, Chemistry, Biology)' },
  { value: 'PCMB', label: 'PCMB (Physics, Chemistry, Math & Biology)' },
]

// Base document types that are common for all streams
export const BASE_DOCUMENT_TYPES = [
  // Academic Documents (Required for all)
  { id: '10th_marksheet', label: '10th Marksheet', category: 'academic', required: true },
  { id: '12th_marksheet', label: '12th Marksheet', category: 'academic', required: true },
  { id: 'leaving_certificate', label: 'Leaving Certificate (LC/TC)', category: 'academic', required: true },

  // Identity & Personal Documents (Required for all)
  { id: 'id_proof', label: 'ID Proof (Aadhar/PAN)', category: 'identity', required: true },
  { id: 'photo', label: 'Passport Photo', category: 'identity', required: true },

  // Category & Income Certificates (Optional for all)
  { id: 'caste_certificate', label: 'Caste Certificate', category: 'category', required: false },
  { id: 'income_certificate', label: 'Income Certificate', category: 'category', required: false },

  // Additional Documents (Optional for all)
  { id: 'gap_certificate', label: 'Gap Certificate', category: 'additional', required: false },
]

// Entrance exam documents based on academic stream
export const ENTRANCE_EXAM_DOCUMENTS = {
  jee_scorecard: { id: 'jee_scorecard', label: 'JEE Scorecard', category: 'entrance', required: true },
  neet_scorecard: { id: 'neet_scorecard', label: 'NEET Scorecard', category: 'entrance', required: true },
  mht_cet_scorecard: { id: 'mht_cet_scorecard', label: 'MHT-CET Scorecard', category: 'entrance', required: true },
}

// Map academic stream to required entrance exam documents
export const STREAM_DOCUMENT_MAP: Record<string, string[]> = {
  PCM: ['jee_scorecard', 'mht_cet_scorecard'],
  PCB: ['neet_scorecard', 'mht_cet_scorecard'],
  PCMB: ['jee_scorecard', 'neet_scorecard', 'mht_cet_scorecard'],
}

// Get all document types for a specific academic stream
export function getDocumentTypesForStream(academicStream: string | null) {
  const entranceDocIds = STREAM_DOCUMENT_MAP[academicStream || 'PCM'] || STREAM_DOCUMENT_MAP.PCM
  const entranceDocs = entranceDocIds.map(id => ENTRANCE_EXAM_DOCUMENTS[id as keyof typeof ENTRANCE_EXAM_DOCUMENTS])

  // Insert entrance docs after academic category
  const academicDocs = BASE_DOCUMENT_TYPES.filter(d => d.category === 'academic')
  const otherDocs = BASE_DOCUMENT_TYPES.filter(d => d.category !== 'academic')
  return [...academicDocs, ...entranceDocs, ...otherDocs]
}

// Legacy export for backward compatibility (all documents)
export const DOCUMENT_TYPES = [
  // Academic Documents (Required)
  { id: '10th_marksheet', label: '10th Marksheet', category: 'academic', required: true },
  { id: '12th_marksheet', label: '12th Marksheet', category: 'academic', required: true },
  { id: 'leaving_certificate', label: 'Leaving Certificate (LC/TC)', category: 'academic', required: true },

  // Entrance Exam Scorecards
  { id: 'mht_cet_scorecard', label: 'MHT-CET Scorecard', category: 'entrance', required: false },
  { id: 'jee_scorecard', label: 'JEE Scorecard', category: 'entrance', required: false },
  { id: 'neet_scorecard', label: 'NEET Scorecard', category: 'entrance', required: false },

  // Identity & Personal Documents (Required)
  { id: 'id_proof', label: 'ID Proof (Aadhar/PAN)', category: 'identity', required: true },
  { id: 'photo', label: 'Passport Photo', category: 'identity', required: true },

  // Category & Income Certificates (Optional)
  { id: 'caste_certificate', label: 'Caste Certificate', category: 'category', required: false },
  { id: 'income_certificate', label: 'Income Certificate', category: 'category', required: false },

  // Additional Documents (Optional)
  { id: 'gap_certificate', label: 'Gap Certificate', category: 'additional', required: false },
]

export const DOCUMENT_CATEGORIES = [
  { id: 'academic', label: 'Academic Documents', icon: 'GraduationCap' },
  { id: 'entrance', label: 'Entrance Exam Scores', icon: 'Award' },
  { id: 'identity', label: 'Identity Documents', icon: 'User' },
  { id: 'category', label: 'Category & Income Certificates', icon: 'FileCheck' },
  { id: 'additional', label: 'Additional Documents', icon: 'FolderPlus' },
]
