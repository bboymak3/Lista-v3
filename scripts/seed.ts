import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/db-auth'
import { v4 as uuidv4 } from 'uuid'

async function main() {
  console.log('🌱 Iniciando seed...')

  // Crear plantel por defecto
  const plantel = await db.plantel.upsert({
    where: { id: 'plantel-default' },
    update: {},
    create: {
      id: 'plantel-default',
      nombre: 'Liceo Demo',
      direccion: 'Caracas, Venezuela',
      lat: 10.4806,
      lng: -66.9036,
      radioM: 200,
      periodoActual: '2024-2025',
    },
  })
  console.log('✅ Plantel creado:', plantel.nombre)

  // Crear sección por defecto
  const section = await db.section.upsert({
    where: { id: 'section-default' },
    update: {},
    create: {
      id: 'section-default',
      nombre: '1° A',
      grado: '1',
      turno: 'manana',
      plantelId: plantel.id,
      periodoEscolar: '2024-2025',
    },
  })
  console.log('✅ Sección creada:', section.nombre)

  // Crear Admin
  const adminPass = await hashPassword('admin123')
  const admin = await db.user.upsert({
    where: { cedula: 'V-00000000' },
    update: {},
    create: {
      cedula: 'V-00000000',
      nombre: 'Administrador',
      apellido: 'Sistema',
      email: 'admin@lista.edu',
      password: adminPass,
      rol: 'admin',
      telefono: '0412-0000000',
    },
  })
  console.log('✅ Admin creado:', admin.cedula, '(password: admin123)')

  // Crear Profesor
  const profPass = await hashPassword('profesor123')
  const profesor = await db.user.upsert({
    where: { cedula: 'V-00000001' },
    update: {},
    create: {
      cedula: 'V-00000001',
      nombre: 'María',
      apellido: 'García',
      email: 'profesor@lista.edu',
      password: profPass,
      rol: 'profesor',
      telefono: '0414-1111111',
    },
  })

  // Asignar profesor como tutor de la sección
  await db.section.update({
    where: { id: section.id },
    data: { tutorId: profesor.id },
  })
  await db.sectionAssignment.upsert({
    where: { sectionId_userId: { sectionId: section.id, userId: profesor.id } },
    update: {},
    create: {
      sectionId: section.id,
      userId: profesor.id,
      role: 'tutor',
    },
  })
  console.log('✅ Profesor creado:', profesor.cedula, '(password: profesor123)')

  // Crear Representante
  const repPass = await hashPassword('representante123')
  const representante = await db.user.upsert({
    where: { cedula: 'V-00000003' },
    update: {},
    create: {
      cedula: 'V-00000003',
      nombre: 'Ana',
      apellido: 'Rodríguez',
      email: 'representante@lista.edu',
      password: repPass,
      rol: 'representante',
      telefono: '0424-3333333',
    },
  })
  console.log('✅ Representante creado:', representante.cedula, '(password: representante123)')

  // Crear Alumno (con login)
  const alumnoPass = await hashPassword('alumno123')
  const alumnoUser = await db.user.upsert({
    where: { cedula: 'V-00000002' },
    update: {},
    create: {
      cedula: 'V-00000002',
      nombre: 'Carlos',
      apellido: 'Pérez',
      email: 'alumno@lista.edu',
      password: alumnoPass,
      rol: 'alumno',
      telefono: '0416-2222222',
    },
  })

  // Crear perfil de estudiante
  const estudiante = await db.student.upsert({
    where: { codigoUnico: 'EST-2024-001' },
    update: {},
    create: {
      codigoUnico: 'EST-2024-001',
      cedulaEscolar: 'V-00000002',
      nombre: 'Carlos',
      apellido: 'Pérez',
      fechaNacimiento: '2008-05-15',
      genero: 'M',
      sectionId: section.id,
      userId: alumnoUser.id,
      qrCode: `QR-${uuidv4()}`,
    },
  })

  // Relación representante-estudiante
  await db.parentStudent.upsert({
    where: {
      representanteId_estudianteId: {
        representanteId: representante.id,
        estudianteId: estudiante.id,
      },
    },
    update: {},
    create: {
      representanteId: representante.id,
      estudianteId: estudiante.id,
      parentesco: 'madre',
      esPrincipal: true,
    },
  })
  console.log('✅ Alumno creado:', alumnoUser.cedula, '(password: alumno123)')

  // Crear estudiantes adicionales (sin login, solo en lista)
  const extraStudents = [
    { codigo: 'EST-2024-002', nombre: 'Lucía', apellido: 'Martínez', genero: 'F' },
    { codigo: 'EST-2024-003', nombre: 'José', apellido: 'López', genero: 'M' },
    { codigo: 'EST-2024-004', nombre: 'Carmen', apellido: 'Hernández', genero: 'F' },
    { codigo: 'EST-2024-005', nombre: 'Miguel', apellido: 'Torres', genero: 'M' },
  ]

  for (const s of extraStudents) {
    await db.student.upsert({
      where: { codigoUnico: s.codigo },
      update: {},
      create: {
        codigoUnico: s.codigo,
        nombre: s.nombre,
        apellido: s.apellido,
        genero: s.genero,
        sectionId: section.id,
        qrCode: `QR-${uuidv4()}`,
      },
    })
  }
  console.log(`✅ ${extraStudents.length} estudiantes adicionales creados`)

  console.log('\n🎉 Seed completado!')
  console.log('\n📌 Credenciales de acceso:')
  console.log('   Admin:         V-00000000 / admin123')
  console.log('   Profesor:      V-00000001 / profesor123')
  console.log('   Alumno:        V-00000002 / alumno123')
  console.log('   Representante: V-00000003 / representante123')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
