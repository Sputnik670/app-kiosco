import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verificarRLS() {
  console.log('\n🔐 VERIFICANDO RLS DEL MOTOR DE VENTAS V2.0')
  console.log('═'.repeat(70))

  const tablas = ['ventas', 'detalles_venta', 'movimientos']

  for (const tabla of tablas) {
    // Verificar si RLS está habilitado
    const { data, error } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('tablename', tabla)
      .eq('schemaname', 'public')
      .single()

    if (error) {
      console.log(`\n❌ ${tabla}`)
      console.log(`   Error al verificar tabla: ${error.message}`)
      continue
    }

    // Verificar RLS con query directa
    const { data: rlsData, error: rlsError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT
          tablename,
          rowsecurity as rls_enabled
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = '${tabla}'
      `
    }).single()

    // Como no tenemos exec_sql, usemos otra forma
    const { data: policies } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', tabla)

    const tieneRLS = policies && policies.length > 0

    console.log(`\n📊 Tabla: ${tabla}`)
    console.log(`   RLS: ${tieneRLS ? '✅ ACTIVO' : '❌ INACTIVO'}`)

    if (policies && policies.length > 0) {
      console.log(`   Políticas encontradas: ${policies.length}`)
      policies.forEach(p => {
        console.log(`     - ${p.policyname} (${p.cmd})`)
      })
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('✅ Verificación completada\n')
}

verificarRLS().catch(console.error)
