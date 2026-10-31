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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#071B31' },
  page: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 42 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#0E3C68', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  brand: { marginLeft: 10, color: '#fff', fontSize: 27, fontWeight: '900' },
  brandBlue: { color: '#0A7AFF' },
  title: { color: '#fff', fontSize: 31, lineHeight: 36, fontWeight: '900' },
  sub: { color: '#B7C7D7', fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 22 },
  label: { color: '#DCE6EF', fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 7 },
  segment: { flexDirection: 'row', backgroundColor: '#0D2D4C', borderRadius: 14, padding: 4 },
  segmentButton: { flex: 1, minHeight: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#0A7AFF' },
  segmentText: { color: '#AFC0CF', fontWeight: '800' },
  segmentTextActive: { color: '#fff' },
  tradeRow: { paddingRight: 15 },
  tradeChip: { paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#0D2D4C', borderRadius: 12, marginRight: 7 },
  tradeChipActive: { backgroundColor: '#0A7AFF' },
  tradeChipText: { color: '#B7C7D7', fontSize: 12, fontWeight: '700' },
  tradeChipTextActive: { color: '#fff' },
  input: { height: 52, borderRadius: 13, backgroundColor: '#fff', color: '#0D1726', paddingHorizontal: 14, fontSize: 16 },
  twoCol: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: '#0A7AFF', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  switchButton: { paddingVertical: 14, alignItems: 'center' },
  switchText: { color: '#8DC6FF', fontWeight: '800', fontSize: 13 },
  switchTextDisabled: { color: '#69849C' },
  verifyCard: { backgroundColor: '#0D2D4C', borderRadius: 16, padding: 14, marginBottom: 8 },
  verifyCardTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  verifyCardText: { color: '#AFC0CF', fontSize: 12, lineHeight: 17, marginTop: 4 },
  passwordRules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
  ruleText: { color: '#7F94A7', fontSize: 10, fontWeight: '700' },
  ruleDone: { color: '#53D6A5' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 18 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#68839B', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#0A7AFF', borderColor: '#0A7AFF' },
  checkboxTick: { color: '#fff', fontWeight: '900', fontSize: 13 },
  termsText: { flex: 1, color: '#B7C7D7', fontSize: 11, lineHeight: 16 },
});
