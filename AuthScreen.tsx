import React, { useState } from 'react';
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

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>('signup');
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [primaryTrade, setPrimaryTrade] = useState('Plumber');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('07');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const signUp = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Enter your name, email and a password of at least 6 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
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

    if (!data.session) {
      setPendingEmail(email.trim().toLowerCase());
      setVerificationCode('');
      setMode('verify');
      return;
    }
  };


  const verifyEmailCode = async () => {
    const token = verificationCode.replace(/\D/g, '');

    if (token.length !== 6) {
      Alert.alert('Enter the code', 'Enter the 6-digit verification code from your email.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token,
      type: 'signup',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Code not accepted', error.message);
    }
  };

  const resendVerificationCode = async () => {
    if (!pendingEmail) return;

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

    Alert.alert('Code sent', 'We sent you a new verification code.');
  };

  const signIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Enter your details', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Could not sign in', error.message);
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
              ? 'Join as a customer or tradesperson.'
              : mode === 'verify'
                ? `Enter the 6-digit code sent to ${pendingEmail}.`
                : 'Sign in to continue to TradeHub.'}
          </Text>

          {mode === 'verify' ? (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                value={verificationCode}
                onChangeText={value => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                style={[styles.input, styles.codeInput]}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <Pressable
                style={[styles.primaryButton, loading && styles.disabled]}
                disabled={loading}
                onPress={verifyEmailCode}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Checking…' : 'Verify email'}
                </Text>
              </Pressable>

              <Pressable style={styles.switchButton} onPress={resendVerificationCode} disabled={loading}>
                <Text style={styles.switchText}>Resend code</Text>
              </Pressable>

              <Pressable style={styles.switchButton} onPress={() => setMode('signup')}>
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
                  <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput value={lastName} onChangeText={setLastName} style={styles.input} />
                </View>
              </View>

              <Text style={styles.label}>Mobile number</Text>
              <TextInput
                value={phone}
                onChangeText={value => setPhone(value.startsWith('07') ? value : '07' + value.replace(/^0+/, ''))}
                style={styles.input}
                keyboardType="phone-pad"
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
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
              />

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
                onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
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
  page: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 36 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 36 },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#0E3C68', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  brand: { marginLeft: 10, color: '#fff', fontSize: 27, fontWeight: '900' },
  brandBlue: { color: '#0A7AFF' },
  title: { color: '#fff', fontSize: 31, lineHeight: 36, fontWeight: '900' },
  sub: { color: '#B7C7D7', fontSize: 15, marginTop: 7, marginBottom: 24 },
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
  disabled: { opacity: 0.6 },
  switchButton: { paddingVertical: 18, alignItems: 'center' },
  switchText: { color: '#8DC6FF', fontWeight: '800', fontSize: 13 },
  codeInput: { textAlign: 'center', fontSize: 27, fontWeight: '900', letterSpacing: 10 },
});
