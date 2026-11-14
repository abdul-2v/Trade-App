import React, { useMemo, useState } from 'react';
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

export default function AuthScreen() {
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

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      letter: /[A-Za-z]/.test(password),
      number: /\d/.test(password),
    }),
    [password]
  );

  const startResendCooldown = () => {
    setResendSeconds(60);
    const timer = setInterval(() => {
      setResendSeconds(current => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
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
            <Text style={styles.brand}>Trade<Text style={styles.brandBlue}>Hub</Text></Text>
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
                : 'Sign in to continue to TradeHub.'}
          </Text>

          {mode === 'verify' ? (
            <>
              <View style={styles.verifyCard}>
                <Text style={styles.verifyCardTitle}>Check your email</Text>
                <Text style={styles.verifyCardText}>
                  We sent a verification link to {pendingEmail}. Open it, confirm your email, then return to TradeHub.
                </Text>
              </View>

              <Pressable
                style={[styles.primaryButton, loading && styles.disabled]}
                disabled={loading}
                onPress={continueAfterVerification}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Checking…' : "I've verified my email"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.switchButton}
                onPress={resendVerificationCode}
                disabled={loading || resendSeconds > 0}
              >
                <Text style={[styles.switchText, resendSeconds > 0 && styles.switchTextDisabled]}>
                  {resendSeconds > 0 ? `Resend email in ${resendSeconds}s` : 'Resend verification email'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.switchButton}
                onPress={() => setMode('signup')}
              >
                <Text style={styles.switchText}>Use a different email</Text>
              </Pressable>
            </>
          ) : mode === 'signup' ? (
            <>
              <Text style={styles.label}>I am joining as</Text>
              <View style={styles.segment}>
                <Pressable
                  style={[styles.segmentButton, accountType === 'customer' && styles.segmentActive]}
                  onPress={() => setAccountType('customer')}
                >
                  <Text style={[styles.segmentText, accountType === 'customer' && styles.segmentTextActive]}>
                    Customer
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentButton, accountType === 'tradesperson' && styles.segmentActive]}
                  onPress={() => setAccountType('tradesperson')}
                >
                  <Text style={[styles.segmentText, accountType === 'tradesperson' && styles.segmentTextActive]}>
                    Tradesperson
                  </Text>
                </Pressable>
              </View>

              {accountType === 'tradesperson' ? (
                <>
                  <Text style={styles.label}>Primary trade</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tradeRow}>
                    {trades.map(item => (
                      <Pressable
                        key={item}
                        style={[styles.tradeChip, primaryTrade === item && styles.tradeChipActive]}
                        onPress={() => setPrimaryTrade(item)}
                      >
                        <Text style={[styles.tradeChipText, primaryTrade === item && styles.tradeChipTextActive]}>
                          {item}
                        </Text>
                      </Pressable>
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
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              />

              {mode === 'signup' ? (
                <>
                  <View style={styles.passwordRules}>
                    <Text style={[styles.ruleText, passwordChecks.length && styles.ruleDone]}>• 8+ characters</Text>
                    <Text style={[styles.ruleText, passwordChecks.letter && styles.ruleDone]}>• Includes a letter</Text>
                    <Text style={[styles.ruleText, passwordChecks.number && styles.ruleDone]}>• Includes a number</Text>
                  </View>

                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    style={styles.input}
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="newPassword"
                  />

                  <Pressable
                    style={styles.termsRow}
                    onPress={() => setAcceptedTerms(value => !value)}
                  >
                    <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
                      {acceptedTerms ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>
                    <Text style={styles.termsText}>
                      I agree to the Terms of Service and Privacy Policy.
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                style={[styles.primaryButton, loading && styles.disabled]}
                disabled={loading}
                onPress={mode === 'signup' ? signUp : signIn}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </Text>
              </Pressable>

              <Pressable
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
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const DISPLAY_FONT = Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F3EC' },
  page: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 46 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 34 },
  logo: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#D66F4F', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  brand: { marginLeft: 10, color: '#111C29', fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  brandBlue: { color: '#C86748' },
  title: { color: '#111C29', fontFamily: DISPLAY_FONT, fontSize: 31, lineHeight: 38, fontWeight: '800', letterSpacing: -0.9 },
  sub: { color: '#657485', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  label: { color: '#344659', fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 7 },
  segment: { flexDirection: 'row', backgroundColor: '#E9E6E0', borderRadius: 14, padding: 4 },
  segmentButton: { flex: 1, minHeight: 47, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#111C29' },
  segmentText: { color: '#6B7885', fontWeight: '800' },
  segmentTextActive: { color: '#FFFDF8' },
  tradeRow: { paddingRight: 15 },
  tradeChip: { paddingHorizontal: 13, paddingVertical: 11, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E0D9CF', borderRadius: 12, marginRight: 7 },
  tradeChipActive: { backgroundColor: '#DCE7ED', borderColor: '#A9C4D4' },
  tradeChipText: { color: '#5F635B', fontSize: 12, fontWeight: '700' },
  tradeChipTextActive: { color: '#24465D' },
  input: { height: 55, borderRadius: 13, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#DDD9D1', color: '#111C29', paddingHorizontal: 15, fontSize: 16 },
  twoCol: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: '#111C29', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryButtonText: { color: '#FFFDF8', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  switchButton: { paddingVertical: 15, alignItems: 'center' },
  switchText: { color: '#315D76', fontWeight: '800', fontSize: 13 },
  switchTextDisabled: { color: '#9B9E96' },
  verifyCard: { backgroundColor: '#E5EBED', borderRadius: 15, padding: 16, marginBottom: 8 },
  verifyCardTitle: { color: '#172B3C', fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: '800' },
  verifyCardText: { color: '#586B79', fontSize: 12, lineHeight: 18, marginTop: 5 },
  passwordRules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
  ruleText: { color: '#8A8D85', fontSize: 10, fontWeight: '700' },
  ruleDone: { color: '#2F8A67' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 18 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#AAA99F', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#C96E52', borderColor: '#C96E52' },
  checkboxTick: { color: '#FFFDF8', fontWeight: '900', fontSize: 13 },
  termsText: { flex: 1, color: '#687786', fontSize: 11, lineHeight: 17 },
});
