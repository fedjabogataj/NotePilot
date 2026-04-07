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
