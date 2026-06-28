import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, KeyRound, Loader2, Plus, Trash2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Passkey {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

// Browser support detection
const supportsWebAuthn = () =>
  typeof window !== 'undefined' &&
  !!(window as any).PublicKeyCredential &&
  typeof navigator.credentials?.create === 'function';

const supportsPlatform = async () => {
  try {
    // @ts-ignore
    return await (window.PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

const bufToB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const PasskeysManager: React.FC = () => {
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_passkeys')
      .select('id, credential_id, device_name, created_at, last_used_at')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load passkeys');
    else setKeys((data as Passkey[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supportsPlatform().then(setPlatformAvailable);
  }, []);

  const register = async () => {
    if (!supportsWebAuthn()) {
      toast.error('Your browser does not support passkeys');
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not signed in'); return; }

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userIdBytes = new TextEncoder().encode(user.id);

      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: 'Medico-Legal Pro', id: window.location.hostname },
        user: {
          id: userIdBytes,
          name: user.email || user.id,
          displayName: user.email || 'User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
        timeout: 60000,
        attestation: 'none',
      };

      const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
      if (!cred) { toast.error('Passkey registration cancelled'); return; }

      const response = cred.response as AuthenticatorAttestationResponse;
      const credentialId = bufToB64(cred.rawId);
      const publicKeyB64 = bufToB64(response.getPublicKey?.() || new ArrayBuffer(0));

      const deviceName = (await supportsPlatform()) ? 'This device (biometric)' : 'Security key';

      const { error } = await supabase.from('user_passkeys').insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKeyB64,
        device_name: deviceName,
        transports: (response as any).getTransports?.() || null,
      });
      if (error) throw error;
      toast.success('Passkey registered');
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Passkey registration failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this passkey? You will no longer be able to use it to sign in.')) return;
    const { error } = await supabase.from('user_passkeys').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Passkey removed');
    load();
  };

  const available = supportsWebAuthn();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Passkeys &amp; Biometric Login
            </CardTitle>
            <CardDescription>
              Sign in with Face ID, Touch ID, Windows Hello or a hardware key instead of typing a password.
            </CardDescription>
          </div>
          <Button size="sm" onClick={register} disabled={!available || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add passkey
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!available && (
          <div className="text-sm text-muted-foreground py-2">
            This browser does not support passkeys. Use Chrome, Edge, Safari 16+ or Firefox 122+.
          </div>
        )}
        {available && platformAvailable && (
          <Badge variant="secondary" className="gap-1 mb-3">
            <Fingerprint className="h-3 w-3" /> Biometric available on this device
          </Badge>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading passkeys…
          </div>
        ) : keys.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No passkeys registered yet. Click "Add passkey" to enrol this device.
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-md bg-background flex items-center justify-center border">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{k.device_name || 'Passkey'}</div>
                    <div className="text-xs text-muted-foreground">
                      Added {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                      {k.last_used_at && ` · last used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}`}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(k.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PasskeysManager;
