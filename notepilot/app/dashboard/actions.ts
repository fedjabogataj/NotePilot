'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type CourseInput = {
  name: string
  code: string
  semester: string
  description: string
}

export async function createCourse(data: CourseInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      user_id: user.id,
      name: data.name,
      code: data.code || null,
      semester: data.semester || null,
      description: data.description || null,
    })
    .select('id')
    .single()

  if (error || !course) throw new Error(error?.message ?? 'Failed to create course')
  revalidatePath('/dashboard')
  return { courseId: course.id }
}

export async function updateCourse(id: string, data: CourseInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('courses')
    .update({
      name: data.name,
      code: data.code || null,
      semester: data.semester || null,
      description: data.description || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function deleteCourse(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function createFolder(
  courseId: string | null,
  parentFolderId: string | null,
  name: string,
  semester?: string | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // When courseId is null but a parent folder exists, inherit the parent's course_id
  // so course-level sub-folders stay associated with their course.
  let resolvedCourseId = courseId
  if (resolvedCourseId === null && parentFolderId !== null) {
    const { data: parent } = await supabase
      .from('folders')
      .select('course_id')
      .eq('id', parentFolderId)
      .eq('user_id', user.id)
      .single()
    resolvedCourseId = parent?.course_id ?? null
  }

  const { error } = await supabase.from('folders').insert({
    user_id: user.id,
    course_id: resolvedCourseId,
    parent_folder_id: parentFolderId,
    name: name.trim(),
    semester: semester ?? null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function renameFolder(id: string, name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('folders')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function deleteFolder(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function moveMaterialToFolder(
  type: 'book' | 'slide' | 'exam',
  materialId: string,
  folderId: string | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const table = type === 'book' ? 'books' : type === 'slide' ? 'lecture_slides' : 'exams'
  const { error } = await supabase
    .from(table)
    .update({ folder_id: folderId })
    .eq('id', materialId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}
