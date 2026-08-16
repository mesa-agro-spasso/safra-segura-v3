import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { WarehouseMultiSelect } from '@/components/common/WarehouseMultiSelect';
import { toast } from 'sonner';
import { warmUpApi } from '@/lib/warmup';
import { useSignupUnits } from '@/hooks/useWarehouses';
import { maskPhoneBR } from '@/lib/masks';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [units, setUnits] = useState<string[]>([]);
  const [confirmSignup, setConfirmSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { data: signupUnits = [] } = useSignupUnits();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // Acorda o backend em segundo plano — não bloqueia o redirecionamento.
      warmUpApi();
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const validateSignUp = () => {
    if (!fullName.trim()) {
      toast.error('Informe seu nome completo');
      return false;
    }
    if (!jobTitle.trim()) {
      toast.error('Informe seu cargo');
      return false;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return false;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return false;
    }
    return true;
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateSignUp()) setConfirmSignup(true);
  };

  const handleSignUp = async () => {
    setConfirmSignup(false);
    setLoading(true);
    try {
      await signUp(email, password, {
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        phone: phone.trim(),
        warehouse_ids: units.length > 0 ? units : undefined,
      });
      toast.success('Cadastro realizado! Seu acesso será analisado por um administrador.');
      navigate('/aguardando-aprovacao');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao cadastrar';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      toast.success('Link de recuperação enviado para seu email.');
      setForgotEmail('');
      setView('login');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar link';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <img src="/logo-spasso.png" alt="Grupo Spasso" className="w-56 mx-auto mb-2 block dark:hidden" />
          <img src="/logo-spasso-dark.png" alt="Grupo Spasso" className="w-56 mx-auto mb-2 hidden dark:block" />
          <p className="text-sm text-muted-foreground">Mesa Integrada de Hedge</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              {view === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email da conta</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder="seu@email.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enviaremos um link para redefinir sua senha.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Voltar
                  </button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo</Label>
                  <Input id="signup-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Seu nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-job">Cargo</Label>
                  <Input id="signup-job" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required placeholder="Ex.: Analista de mesa" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Telefone <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input id="signup-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhoneBR(e.target.value))} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Unidades</Label>
                  <WarehouseMultiSelect
                    options={signupUnits.map((w) => ({ id: w.id, display_name: w.display_name }))}
                    value={units}
                    onChange={setUnits}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar senha</Label>
                  <Input id="signup-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={confirmSignup} onOpenChange={setConfirmSignup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cadastro</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Confira as unidades solicitadas antes de enviar:</p>
                <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 font-medium text-foreground">
                  {units.length === 0
                    ? 'Sede (acesso a todas as unidades)'
                    : units
                        .map((id) => signupUnits.find((w) => w.id === id)?.display_name ?? id)
                        .join(' · ')}
                </div>
                <p className="text-muted-foreground">O acesso será liberado após aprovação de um administrador.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSignUp()}>Confirmar cadastro</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Login;
