<template>
  <div class="register-form">
    <h2>Register</h2>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="email">Email (optional)</label>
        <input 
          type="email" 
          id="email" 
          v-model="email"
          placeholder="For account recovery (optional)"
        >
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input 
          type="password" 
          id="password" 
          v-model="password"
          required
          placeholder="Enter password"
        >
      </div>
      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input 
          type="password" 
          id="confirmPassword" 
          v-model="confirmPassword"
          required
          placeholder="Confirm password"
        >
      </div>
      <div class="error" v-if="error">{{ error }}</div>
      <button type="submit" :disabled="isSubmitting">Register</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const isSubmitting = ref(false)

async function handleSubmit() {
  error.value = ''
  isSubmitting.value = true

  try {
    if (password.value !== confirmPassword.value) {
      throw new Error('Passwords do not match')
    }

    const response = await fetch('/register.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: email.value,
        password: password.value
      })
    })

    // Add this to debug
    const text = await response.text()
    console.log('Response:', text)
    
    const data = JSON.parse(text)  // This is where it's failing

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Registration failed')
    }

    // Clear form and redirect on success
    email.value = ''
    password.value = ''
    confirmPassword.value = ''
    router.push('/login?registered=1')

  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Registration failed'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.register-form {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.error {
  color: red;
  margin: 1rem 0;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style> 