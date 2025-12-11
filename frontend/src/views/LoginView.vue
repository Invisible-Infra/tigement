<template>
  <div class="login-view">
    <LoginForm @login-success="$emit('login-success', $event)" />
  </div>
</template>

<script setup lang="ts">
import LoginForm from '@/components/auth/LoginForm.vue'

defineEmits(['login-success'])
</script>

<style scoped>
.login-view {
  padding: 2rem;
}
</style> 