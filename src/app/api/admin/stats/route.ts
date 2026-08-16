import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query, d1First } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/admin/stats — dashboard stats + attendance chart data + recent activity
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  // Asistencia por sección (últimos 7 días)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  if (isD1()) {
    // Producción: D1 con COUNT(*) y subconsultas
    const [studentsR, sectionsR, professorsR, plantelsR] = await Promise.all([
      d1First<{ count: number }>('SELECT COUNT(*) as count FROM v3_students WHERE activo = 1'),
      d1First<{ count: number }>('SELECT COUNT(*) as count FROM v3_sections WHERE activa = 1'),
      d1First<{ count: number }>("SELECT COUNT(*) as count FROM v3_users WHERE rol = 'profesor' AND activo = 1"),
      d1First<{ count: number }>('SELECT COUNT(*) as count FROM v3_plantels'),
    ])

    const totalStudents = studentsR?.count || 0
    const totalSections = sectionsR?.count || 0
    const totalProfessors = professorsR?.count || 0
    const totalPlantels = plantelsR?.count || 0

    // Asistencia de hoy
    const todayAttendance = await d1Query<{ id: string; estado: string; estudianteId: string }>(
      'SELECT id, estado, estudianteId FROM v3_attendance WHERE fecha >= ? AND fecha <= ?',
      [startOfDay.toISOString(), endOfDay.toISOString()]
    )

    const presentCount = todayAttendance.filter((a) => a.estado === 'presente').length
    const attendanceRate = todayAttendance.length > 0
      ? Math.round((presentCount / todayAttendance.length) * 100)
      : 0

    // Asistencia reciente (7 días) con sectionId del estudiante
    const recentAttendance = await d1Query<{
      id: string
      estado: string
      estudianteId: string
      sectionId: string
    }>(
      `SELECT a.id, a.estado, a.estudianteId, s.sectionId
       FROM v3_attendance a
       INNER JOIN v3_students s ON s.id = a.estudianteId
       WHERE a.fecha >= ?`,
      [sevenDaysAgo.toISOString()]
    )

    const sections = await d1Query<{ id: string; nombre: string }>(
      'SELECT id, nombre FROM v3_sections WHERE activa = 1'
    )

    const attendanceBySection = sections.map((s) => {
      const sectionAttendance = recentAttendance.filter((a) => a.sectionId === s.id)
      const present = sectionAttendance.filter((a) => a.estado === 'presente').length
      const total = sectionAttendance.length
      return {
        section: s.nombre,
        presente: present,
        ausente: sectionAttendance.filter((a) => a.estado === 'ausente').length,
        tardanza: sectionAttendance.filter((a) => a.estado === 'tardanza').length,
        total,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
      }
    })

    // Actividad reciente: attendance, users, sessions
    const [recentMarks, recentUsers, recentSessions] = await Promise.all([
      d1Query<{
        id: string
        estado: string
        fecha: string
        origen: string
        estudianteNombre: string
        estudianteApellido: string
      }>(
        `SELECT a.id, a.estado, a.fecha, a.origen, s.nombre AS estudianteNombre, s.apellido AS estudianteApellido
         FROM v3_attendance a
         INNER JOIN v3_students s ON s.id = a.estudianteId
         ORDER BY a.fecha DESC
         LIMIT 7`
      ),
      d1Query<{
        id: string
        nombre: string
        apellido: string
        rol: string
        createdAt: string
      }>(
        'SELECT id, nombre, apellido, rol, createdAt FROM v3_users ORDER BY createdAt DESC LIMIT 5'
      ),
      d1Query<{
        id: string
        fecha: string
        estado: string
        sectionNombre: string
      }>(
        `SELECT sess.id, sess.fecha, sess.estado, sec.nombre AS sectionNombre
         FROM v3_attendance_sessions sess
         LEFT JOIN v3_sections sec ON sec.id = sess.sectionId
         ORDER BY sess.createdAt DESC
         LIMIT 5`
      ),
    ])

    const recentActivity = [
      ...recentMarks.map((m) => ({
        type: 'attendance' as const,
        id: m.id,
        title: `${m.estudianteNombre} ${m.estudianteApellido}`,
        description: `Asistencia: ${m.estado} (${m.origen})`,
        fecha: m.fecha,
      })),
      ...recentUsers.map((u) => ({
        type: 'user' as const,
        id: u.id,
        title: `${u.nombre} ${u.apellido}`,
        description: `Nuevo usuario: ${u.rol}`,
        fecha: u.createdAt,
      })),
      ...recentSessions.map((s) => ({
        type: 'session' as const,
        id: s.id,
        title: s.sectionNombre || 'Sesión',
        description: `Sesión ${s.estado}`,
        fecha: s.fecha,
      })),
    ]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 10)

    return NextResponse.json({
      totals: {
        students: totalStudents,
        sections: totalSections,
        professors: totalProfessors,
        plantels: totalPlantels,
      },
      attendance: {
        todayRate: attendanceRate,
        todayTotal: todayAttendance.length,
        todayPresent: presentCount,
      },
      attendanceBySection,
      recentActivity,
    })
  }

  // Desarrollo: Prisma
  const [totalStudents, totalSections, totalProfessors, totalPlantels] = await Promise.all([
    db.student.count({ where: { activo: true } }),
    db.section.count({ where: { activa: true } }),
    db.user.count({ where: { rol: 'profesor', activo: true } }),
    db.plantel.count(),
  ])

  // Asistencia de hoy
  const todayAttendance = await db.attendance.findMany({
    where: { fecha: { gte: startOfDay, lte: endOfDay } },
    select: { estado: true, estudianteId: true },
  })

  const presentCount = todayAttendance.filter((a) => a.estado === 'presente').length
  const attendanceRate = todayAttendance.length > 0
    ? Math.round((presentCount / todayAttendance.length) * 100)
    : 0

  // Asistencia por sección (últimos 7 días)
  const recentAttendance = await db.attendance.findMany({
    where: { fecha: { gte: sevenDaysAgo } },
    select: {
      estado: true,
      estudiante: { select: { sectionId: true } },
    },
  })

  const sections = await db.section.findMany({
    where: { activa: true },
    select: { id: true, nombre: true },
  })

  const attendanceBySection = sections.map((s) => {
    const sectionAttendance = recentAttendance.filter((a) => a.estudiante.sectionId === s.id)
    const present = sectionAttendance.filter((a) => a.estado === 'presente').length
    const total = sectionAttendance.length
    return {
      section: s.nombre,
      presente: present,
      ausente: sectionAttendance.filter((a) => a.estado === 'ausente').length,
      tardanza: sectionAttendance.filter((a) => a.estado === 'tardanza').length,
      total,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    }
  })

  // Actividad reciente
  const [recentMarks, recentUsers, recentSessions] = await Promise.all([
    db.attendance.findMany({
      take: 7,
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        estado: true,
        fecha: true,
        origen: true,
        estudiante: { select: { nombre: true, apellido: true } },
      },
    }),
    db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, nombre: true, apellido: true, rol: true, createdAt: true },
    }),
    db.attendanceSession.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fecha: true,
        estado: true,
        section: { select: { nombre: true } },
      },
    }),
  ])

  const recentActivity = [
    ...recentMarks.map((m) => ({
      type: 'attendance' as const,
      id: m.id,
      title: `${m.estudiante.nombre} ${m.estudiante.apellido}`,
      description: `Asistencia: ${m.estado} (${m.origen})`,
      fecha: m.fecha,
    })),
    ...recentUsers.map((u) => ({
      type: 'user' as const,
      id: u.id,
      title: `${u.nombre} ${u.apellido}`,
      description: `Nuevo usuario: ${u.rol}`,
      fecha: u.createdAt,
    })),
    ...recentSessions.map((s) => ({
      type: 'session' as const,
      id: s.id,
      title: s.section?.nombre || 'Sesión',
      description: `Sesión ${s.estado}`,
      fecha: s.fecha,
    })),
  ]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 10)

  return NextResponse.json({
    totals: {
      students: totalStudents,
      sections: totalSections,
      professors: totalProfessors,
      plantels: totalPlantels,
    },
    attendance: {
      todayRate: attendanceRate,
      todayTotal: todayAttendance.length,
      todayPresent: presentCount,
    },
    attendanceBySection,
    recentActivity,
  })
}
