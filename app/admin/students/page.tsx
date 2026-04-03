'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Input'
import { formatDate, formatDateTime } from '@/lib/utils'
import { STUDENT_DOCUMENTS_BUCKET } from '@/lib/supabase/storage'
import { Users, Search, ChevronRight, SlidersHorizontal, Cog, FileText, MessageSquare, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'

interface StudentWithDetails {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  last_login_at: string | null
  created_at: string
  // Counts from related tables
  documents_count: number
  has_application: boolean
  application_status: string | null
  chat_messages_count: number
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Students' },
  { value: 'with_application', label: 'With Application' },
  { value: 'no_application', label: 'No Application Yet' },
]

const PAGE_SIZE = 10

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchStudents()
  }, [search, statusFilter, page])

  const fetchStudents = async () => {
    setLoading(true)
    const supabase = createClient()

    // Fetch all student profiles
    let query = supabase
      .from('student_profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: studentsData, count } = await query
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (!studentsData) {
      setStudents([])
      setTotal(0)
      setLoading(false)
      return
    }

    // Fetch related data for each student
    const studentIds = studentsData.map(s => s.id)

    const [docsRes, appsRes, chatsRes] = await Promise.all([
      supabase.from('documents').select('student_id').in('student_id', studentIds),
      supabase.from('applications').select('student_id, status').in('student_id', studentIds),
      supabase.from('chat_messages').select('student_id').in('student_id', studentIds),
    ])

    // Count documents per student
    const docCounts: Record<string, number> = {}
    docsRes.data?.forEach(d => {
      docCounts[d.student_id] = (docCounts[d.student_id] || 0) + 1
    })

    // Get application status per student
    const appStatus: Record<string, string> = {}
    appsRes.data?.forEach(a => {
      appStatus[a.student_id] = a.status
    })

    // Count chat messages per student
    const chatCounts: Record<string, number> = {}
    chatsRes.data?.forEach(c => {
      chatCounts[c.student_id] = (chatCounts[c.student_id] || 0) + 1
    })

    // Combine data
    let enrichedStudents: StudentWithDetails[] = studentsData.map(s => ({
      ...s,
      documents_count: docCounts[s.id] || 0,
      has_application: !!appStatus[s.id],
      application_status: appStatus[s.id] || null,
      chat_messages_count: chatCounts[s.id] || 0,
    }))

    // Apply status filter
    if (statusFilter === 'with_application') {
      enrichedStudents = enrichedStudents.filter(s => s.has_application)
    } else if (statusFilter === 'no_application') {
      enrichedStudents = enrichedStudents.filter(s => !s.has_application)
    }

    setStudents(enrichedStudents)
    setTotal(count || 0)
    setLoading(false)
  }

  const processStudent = async (e: React.MouseEvent, student: StudentWithDetails) => {
    e.stopPropagation()
    setProcessingId(student.id)

    try {
      const supabase = createClient()

      // Fetch student's documents
      const { data: documents } = await supabase
        .from('documents')
        .select('*')
        .eq('student_id', student.id)

      if (!documents || documents.length === 0) {
        toast.error('No documents found for this student')
        setProcessingId(null)
        return
      }

      // Generate signed URLs for all documents
      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          const { data } = await supabase.storage
            .from(STUDENT_DOCUMENTS_BUCKET)
            .createSignedUrl(doc.file_path, 3600)
          return {
            docType: doc.document_type,
            filePath: doc.file_path,
            fileName: doc.file_name,
            signedUrl: data?.signedUrl || '',
          }
        })
      )

      // Call n8n webhook
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_DOCUMENT_WEBHOOK_URL || '/api/extract-documents'
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.full_name,
          studentEmail: student.email,
          documents: docsWithUrls,
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        toast.success('Student data sent for processing!')
      } else {
        toast.error('Failed to process student')
      }
    } catch (err) {
      console.error('Process student error:', err)
      toast.error('Failed to process student')
    } finally {
      setProcessingId(null)
    }
  }

  const isOnline = (lastLogin: string | null) => {
    if (!lastLogin) return false
    const diff = Date.now() - new Date(lastLogin).getTime()
    return diff < 15 * 60 * 1000
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
            <Users className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Students</h1>
            <p className="text-slate-400 text-sm">{total} registered students</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filter & Search</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              suppressHydrationWarning
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search by name or email..."
              className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          />
        </div>
        {(search || statusFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setPage(0) }}
            className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                {['Student', 'Status', 'Documents', 'Chats', 'Registered', 'Last Active', 'Actions', ''].map(col => (
                  <th key={col} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => {
                      if (student.has_application) {
                        // Find application and navigate
                        router.push(`/admin/students?search=${encodeURIComponent(student.email || '')}`)
                      }
                    }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {student.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          {isOnline(student.last_login_at) && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-800 rounded-full"></span>
                          )}
                        </div>
                        <div>
                          <span className="text-white font-medium text-sm whitespace-nowrap block">{student.full_name || 'Unknown'}</span>
                          <span className="text-slate-400 text-xs">{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {student.has_application ? (
                        <Badge variant="status" status={student.application_status || 'pending'}>
                          {student.application_status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-lg">
                          No application
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-white text-sm">{student.documents_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-white text-sm">{student.chat_messages_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(student.created_at)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-slate-400 text-xs whitespace-nowrap">
                        {student.last_login_at ? (
                          isOnline(student.last_login_at) ? (
                            <span className="text-emerald-400">Online</span>
                          ) : (
                            formatDateTime(student.last_login_at)
                          )
                        ) : (
                          'Never'
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <Button 
                        size="sm"
                        onClick={(e) => processStudent(e, student)}
                        loading={processingId === student.id}
                        disabled={student.documents_count === 0}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-xs px-3 py-1.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Cog className="w-3 h-3" />
                        Process
                      </Button>
                    </td>
                    <td className="px-5 py-4">
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-700/50 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
