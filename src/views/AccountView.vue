<script setup>
import { LogIn, UserPlus } from 'lucide-vue-next';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Alert from '../components/ui/alert/Alert.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import Input from '../components/ui/input/Input.vue';
import { authClient, authState, refreshSession, signOutAccount } from '../services/auth';

const router = useRouter();
const mode = ref('login');
const submitting = ref(false);
const error = ref('');
const form = reactive({ name: '', email: '', password: '' });
const title = computed(() => (mode.value === 'login' ? '登录账号' : '创建账号'));

function switchMode(nextMode) {
  mode.value = nextMode;
  error.value = '';
}

async function submit() {
  error.value = '';
  submitting.value = true;

  try {
    const result = mode.value === 'login'
      ? await authClient.signIn.email({ email: form.email.trim(), password: form.password })
      : await authClient.signUp.email({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password
        });

    if (result.error) throw new Error(result.error.message || '账号操作失败');
    await refreshSession();
    await router.push({ name: 'novel-home' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '账号操作失败';
  } finally {
    submitting.value = false;
  }
}

async function logout() {
  submitting.value = true;
  try {
    await signOutAccount();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5">
    <Card v-if="authState.user">
      <CardHeader>
        <CardDescription>当前账号</CardDescription>
        <CardTitle class="text-3xl">{{ authState.user.name }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-5">
        <div class="rounded-2xl border border-border/70 bg-background p-4">
          <p class="text-sm text-muted-foreground">登录邮箱</p>
          <p class="mt-1 font-medium">{{ authState.user.email }}</p>
        </div>
        <Alert variant="info">阅读进度会按当前账号保存到 Cloudflare D1。</Alert>
        <Button variant="outline" :disabled="submitting" @click="logout">退出登录</Button>
      </CardContent>
    </Card>

    <Card v-else>
      <CardHeader>
        <div class="mb-3 grid grid-cols-2 gap-2">
          <Button :variant="mode === 'login' ? 'default' : 'outline'" @click="switchMode('login')">
            <LogIn class="mr-1 size-4" />登录
          </Button>
          <Button :variant="mode === 'register' ? 'default' : 'outline'" @click="switchMode('register')">
            <UserPlus class="mr-1 size-4" />注册
          </Button>
        </div>
        <CardTitle class="text-3xl">{{ title }}</CardTitle>
        <CardDescription>登录后可在不同设备同步阅读位置。</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div v-if="mode === 'register'" class="space-y-2">
            <label class="text-sm font-medium" for="account-name">昵称</label>
            <Input id="account-name" v-model="form.name" autocomplete="name" placeholder="请输入昵称" required />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium" for="account-email">邮箱</label>
            <Input id="account-email" v-model="form.email" type="email" autocomplete="email" placeholder="name@example.com" required />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium" for="account-password">密码</label>
            <Input
              id="account-password"
              v-model="form.password"
              type="password"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              placeholder="至少 8 个字符"
              minlength="8"
              required
            />
          </div>
          <Alert v-if="error" variant="error">{{ error }}</Alert>
          <Button class="w-full" type="submit" :disabled="submitting">
            {{ submitting ? '处理中...' : title }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
