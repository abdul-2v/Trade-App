import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from './lib/supabase';
import { theme } from './theme';
import { MotionPressable } from './Motion';
import { Eye, EyeOff, ArrowRight } from 'lucide-react-native';

type AccountType = 'customer' | 'tradesperson';

const trades = ['Plumber', 'Electrician', 'Builder', 'Heating', 'Locksmith', 'Carpenter', 'Roofer'];

const normaliseUkMobile = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '07';
  if (digits.startsWith('44')) return '0' + digits.slice(2, 12);
  if (digits.startsWith('7')) return '0' + digits.slice(0, 10);
  if (digits.startsWith('0')) return digits.slice(0, 11);
  return '07' + digits.slice(0, 9);
};

export default function AuthScreen({ onForgotPassword }: { onForgotPassword?: (email: string) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>('signup');
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [primaryTrade, setPrimaryTrade] = useState('Plumber');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('07');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const resendTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  useEffect(()=>()=>{if(resendTimerRef.current)clearInterval(resendTimerRef.current);},[]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      letter: /[A-Za-z]/.test(password),
      number: /\d/.test(password),
    }),
    [password]
  );

  const startResendCooldown = () => {
    if(resendTimerRef.current)clearInterval(resendTimerRef.current);
    setResendSeconds(60);
    resendTimerRef.current=setInterval(()=>{
      setResendSeconds(current=>{
        if(current<=1){
          if(resendTimerRef.current)clearInterval(resendTimerRef.current);
          resendTimerRef.current=null;
          return 0;
        }
        return current-1;
      });
    },1000);
  };

  const signUp = async () => {
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normaliseUkMobile(phone);

    if (!cleanFirst || !cleanLast) {
      Alert.alert('Enter your name', 'Please enter your first and last name.');
      return;
    }

    if (!/^07\d{9}$/.test(cleanPhone)) {
      Alert.alert('Check your mobile number', 'Enter a valid UK mobile number beginning with 07.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      Alert.alert('Check your email', 'Enter a valid email address.');
      return;
    }

    if (!passwordChecks.length || !passwordChecks.letter || !passwordChecks.number) {
      Alert.alert('Make your password stronger', 'Use at least 8 characters with a letter and a number.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password in both password fields.');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Terms required', 'Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          first_name: cleanFirst,
          last_name: cleanLast,
          phone: cleanPhone,
          account_type: accountType,
          primary_trade: accountType === 'tradesperson' ? primaryTrade : null,
        },
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert('Could not create account', error.message);
      return;
    }

    if (data.session) {
      return;
    }

    setPendingEmail(cleanEmail);
    setMode('verify');
    startResendCooldown();
  };

  const continueAfterVerification = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: pendingEmail,
      password,
    });

    setLoading(false);

    if (error) {
      const notConfirmed = error.message.toLowerCase().includes('email not confirmed');
      Alert.alert(
        notConfirmed ? 'Email not verified yet' : 'Could not sign in',
        notConfirmed
          ? 'Open the verification email, tap the confirmation link, then come back and try again.'
          : error.message
      );
    }
  };

  const resendVerificationCode = async () => {
    if (!pendingEmail || loading || resendSeconds > 0) return;

    setLoading(true);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Could not resend code', error.message);
      return;
    }

    startResendCooldown();
    Alert.alert('Code sent', 'A new verification email has been sent.');
  };

  const signIn = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert('Enter your details', 'Enter your email and password.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setLoading(false);

    if (error) {
      const message = error.message.toLowerCase().includes('email not confirmed')
        ? 'Verify your email before signing in.'
        : error.message;
      Alert.alert('Could not sign in', message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
            <View>
              <Text style={styles.brand}>Trad<Text style={styles.brandBlue}>arr</Text></Text>
              <Text style={styles.brandCaption}>LOCAL HELP. MADE SIMPLE.</Text>
            </View>
          </View>

          <Text style={styles.title}>
            {mode === 'signup'
              ? 'Create your account'
              : mode === 'verify'
                ? 'Verify your email'
                : 'Welcome back'}
          </Text>

          <Text style={styles.sub}>
            {mode === 'signup'
              ? 'Find trusted tradespeople or join as a trade professional.'
              : mode === 'verify'
                ? `Confirm the verification email sent to ${pendingEmail}.`
                : 'Sign in to continue to Tradarr.'}
          </Text>

          {mode === 'verify' ? (
            <>
              <View style={styles.verifyCard}>
                <Text style={styles.verifyCardTitle}>Check your email</Text>
                <Text style={styles.verifyCardText}>
                  We sent a verification link to {pendingEmail}. Open it, confirm your email, then return to Tradarr.
                </Text>
              </View>

              <MotionPressable
                style={[styles.primaryButton, loading && styles.disabled]}
                disabled={loading}
                onPress={continueAfterVerification}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Checking…' : "I've verified my email"}
                </Text>
                {!loading ? <ArrowRight color="#FFFFFF" size={19} strokeWidth={2.2} /> : null}
              </MotionPressable>

              <MotionPressable
                style={styles.switchButton}
                onPress={resendVerificationCode}
                disabled={loading || resendSeconds > 0}
              >
                <Text style={[styles.switchText, resendSeconds > 0 && styles.switchTextDisabled]}>
                  {resendSeconds > 0 ? `Resend email in ${resendSeconds}s` : 'Resend verification email'}
                </Text>
              </MotionPressable>

              <MotionPressable
                style={styles.switchButton}
                onPress={() => setMode('signup')}
              >
                <Text style={styles.switchText}>Use a different email</Text>
              </MotionPressable>
            </>
          ) : mode === 'signup' ? (
            <>
              <Text style={styles.segmentLabel}>I'M JOINING AS</Text>
              <View style={styles.segment}>
                <MotionPressable
                  style={[styles.segmentButton, accountType === 'customer' && styles.segmentActive]}
                  onPress={() => setAccountType('customer')}
                >
                  <Text style={[styles.segmentText, accountType === 'customer' && styles.segmentTextActive]}>
                    Customer
                  </Text>
                </MotionPressable>
                <MotionPressable
                  style={[styles.segmentButton, accountType === 'tradesperson' && styles.segmentActive]}
                  onPress={() => setAccountType('tradesperson')}
                >
                  <Text style={[styles.segmentText, accountType === 'tradesperson' && styles.segmentTextActive]}>
                    Tradesperson
                  </Text>
                </MotionPressable>
              </View>

              {accountType === 'tradesperson' ? (
                <>
                  <Text style={styles.label}>Primary trade</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tradeRow}>
                    {trades.map(item => (
                      <MotionPressable
                        key={item}
                        style={[styles.tradeChip, primaryTrade === item && styles.tradeChipActive]}
                        onPress={() => setPrimaryTrade(item)}
                      >
                        <Text style={[styles.tradeChipText, primaryTrade === item && styles.tradeChipTextActive]}>
                          {item}
                        </Text>
                      </MotionPressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <View style={styles.twoCol}>
                <View style={styles.half}>
                  <Text style={styles.label}>First name</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    style={styles.input}
                    autoCapitalize="words"
                    textContentType="givenName"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    style={styles.input}
                    autoCapitalize="words"
                    textContentType="familyName"
                  />
                </View>
              </View>

              <Text style={styles.label}>Mobile number</Text>
              <TextInput
                value={phone}
                onChangeText={value => setPhone(normaliseUkMobile(value))}
                style={styles.input}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                maxLength={11}
              />
            </>
          ) : null}

          {mode !== 'verify' ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                />
                <MotionPressable style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff color={theme.colors.muted} size={21} strokeWidth={2} /> : <Eye color={theme.colors.muted} size={21} strokeWidth={2} />}
                </MotionPressable>
              </View>

              {mode === 'signin' ? (
                <MotionPressable
                  style={styles.forgotPasswordButton}
                  onPress={() => onForgotPassword?.(email)}
                  accessibilityRole="button"
                  accessibilityLabel="Reset forgotten password"
                >
                  <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
                </MotionPressable>
              ) : null}

              {mode === 'signup' ? (
                <>
                  <View style={styles.passwordRules}>
                    <Text style={[styles.ruleText, passwordChecks.length && styles.ruleDone]}>• 8+ characters</Text>
                    <Text style={[styles.ruleText, passwordChecks.letter && styles.ruleDone]}>• Includes a letter</Text>
                    <Text style={[styles.ruleText, passwordChecks.number && styles.ruleDone]}>• Includes a number</Text>
                  </View>

                  <Text style={styles.label}>Confirm password</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      style={styles.passwordInput}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      textContentType="newPassword"
                    />
                    <MotionPressable style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} onPress={() => setShowConfirm(v => !v)}>
                      {showConfirm ? <EyeOff color={theme.colors.muted} size={21} strokeWidth={2} /> : <Eye color={theme.colors.muted} size={21} strokeWidth={2} />}
                    </MotionPressable>
                  </View>

                  <MotionPressable
                    style={styles.termsRow}
                    onPress={() => setAcceptedTerms(value => !value)}
                  >
                    <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
                      {acceptedTerms ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>
                    <Text style={styles.termsText}>
                      I agree to the Terms of Service and Privacy Policy.
                    </Text>
                  </MotionPressable>
                </>
              ) : null}

              <MotionPressable
                style={[styles.primaryButton, loading && styles.disabled]}
                disabled={loading}
                onPress={mode === 'signup' ? signUp : signIn}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </Text>
                {!loading ? <ArrowRight color="#FFFFFF" size={19} strokeWidth={2.2} /> : null}
              </MotionPressable>

              <MotionPressable
                style={styles.switchButton}
                onPress={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.switchText}>
                  {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
                </Text>
              </MotionPressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const DISPLAY_FONT = Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.customerBackground },
  page: { paddingHorizontal: 25, paddingTop: 27, paddingBottom: 65 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 39, gap: 11 },
  logo: { width: 47, height: 47, borderRadius: 15, backgroundColor: theme.colors.coral, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  brand: { color: theme.colors.ink, fontFamily: DISPLAY_FONT, fontSize: 29, fontWeight: '800', letterSpacing: -1.15 },
  brandBlue: { color: theme.colors.coralDark },
  brandCaption: { marginTop: 1, color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: theme.colors.ink, fontFamily: DISPLAY_FONT, fontSize: 34, lineHeight: 42, fontWeight: '800', letterSpacing: -1.15 },
  sub: { color: theme.colors.muted, fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 26 },
  label: { color: theme.colors.ink, fontSize: 13, fontWeight: '700', marginTop: 15, marginBottom: 8 },
  segmentLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.1, marginTop: 7, marginBottom: 10 },
  segment: { flexDirection: 'row', backgroundColor: '#EAE7E0', borderRadius: 21, padding: 5, marginBottom: 6 },
  segmentButton: { flex: 1, minHeight: 49, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: theme.colors.darkTeal },
  segmentText: { color: theme.colors.muted, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: '#FFFFFF' },
  tradeRow: { paddingRight: 15, paddingVertical: 2 },
  tradeChip: { paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#FFFFFF', borderRadius: 21, marginRight: 8 },
  tradeChipActive: { backgroundColor: theme.colors.tealTint, borderWidth: 1, borderColor: theme.colors.teal },
  tradeChipText: { color: theme.colors.muted, fontSize: 13, fontWeight: '700' },
  tradeChipTextActive: { color: theme.colors.teal },
  input: { minHeight: 56, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2DFD7', color: theme.colors.ink, paddingHorizontal: 16, fontSize: 16 },
  passwordInputWrap: { minHeight: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2DFD7', borderRadius: 20 },
  passwordInput: { flex: 1, minHeight: 54, color: theme.colors.ink, fontSize: 16, paddingHorizontal: 16 },
  eyeButton: { width: 48, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  twoCol: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  primaryButton: { minHeight: 56, borderRadius: 28, backgroundColor: theme.colors.darkTeal, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 13, marginTop: 27, ...theme.shadow },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  switchButton: { minHeight: 44, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  switchText: { color: theme.colors.teal, fontWeight: '800', fontSize: 14 },
  switchTextDisabled: { color: theme.colors.muted },
  forgotPasswordButton: { alignSelf: 'flex-end', minHeight: 44, paddingVertical: 12, paddingLeft: 12 },
  forgotPasswordText: { color: theme.colors.teal, fontSize: 13, fontWeight: '700' },
  verifyCard: { backgroundColor: '#FFFFFF', borderRadius: 25, padding: 20, marginBottom: 10, ...theme.shadow },
  verifyCardTitle: { color: theme.colors.ink, fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: '800' },
  verifyCardText: { color: theme.colors.muted, fontSize: 14, lineHeight: 22, marginTop: 7 },
  passwordRules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9, gap: 10 },
  ruleText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  ruleDone: { color: theme.colors.success },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 19, minHeight: 44 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#B2B7B1', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  checkboxActive: { backgroundColor: theme.colors.teal, borderColor: theme.colors.teal },
  checkboxTick: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  termsText: { flex: 1, color: theme.colors.muted, fontSize: 13, lineHeight: 18 },
});
