// Seed users for TechMold POS
// Run with: npx tsx scripts/seed-users.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const users = [
  {
    email: 'mckearmz@gmail.com',
    password: 'POS@Techmold2026',
    full_name: 'Owner Admin',
    role: 'admin'
  },
  {
    email: 'mcsheppy4@gmail.com',
    password: 'POS7890',
    full_name: 'Cashier',
    role: 'cashier'
  }
]

async function seedUsers() {
  console.log('Starting user seed...')

  for (const user of users) {
    console.log(`\nCreating user: ${user.email}`)

    // Create user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name
      }
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`  User ${user.email} already exists, updating profile...`)
        
        // Get existing user
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users.find(u => u.email === user.email)
        
        if (existingUser) {
          // Update profile role
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: user.role, full_name: user.full_name })
            .eq('id', existingUser.id)

          if (updateError) {
            console.error(`  Failed to update profile: ${updateError.message}`)
          } else {
            console.log(`  Updated profile for ${user.email} with role: ${user.role}`)
          }
        }
        continue
      }
      console.error(`  Failed to create user: ${authError.message}`)
      continue
    }

    if (authData.user) {
      console.log(`  Created auth user: ${authData.user.id}`)

      // Update the profile with the correct role (trigger creates with 'cashier' by default)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: user.role, full_name: user.full_name })
        .eq('id', authData.user.id)

      if (profileError) {
        console.error(`  Failed to update profile: ${profileError.message}`)
      } else {
        console.log(`  Set role to: ${user.role}`)
      }
    }
  }

  console.log('\n✓ User seed complete!')
  console.log('\nCredentials:')
  console.log('  Owner (admin): mckearmz@gmail.com / POS@Techmold2026')
  console.log('  Cashier: mcsheppy4@gmail.com / POS7890')
}

seedUsers().catch(console.error)
