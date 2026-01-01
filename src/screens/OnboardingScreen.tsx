import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useThemeColor } from '../hooks/useThemeColor';
import { createUserProfile } from '../services/userService';
import { PayFrequency } from '../types';

export const OnboardingScreen = () => {
  const colors = useThemeColor();
  const router = useRouter();
  const { user, checkProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    currencyCode: 'GBP',
    currencySymbol: '£',
    payFrequency: PayFrequency.MONTHLY_LAST_WORKING_DAY,
    lastPayDate: '', // YYYY-MM-DD
    payDayOfMonth: '', // 1-31
    baseIncome: '',
  });

  const updateForm = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step === 1 && !formData.displayName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (step === 2 && (!formData.currencyCode.trim() || !formData.currencySymbol.trim())) {
      Alert.alert('Required', 'Please enter currency details.');
      return;
    }
    if (step === 4) {
      if (
        (formData.payFrequency === PayFrequency.WEEKLY ||
         formData.payFrequency === PayFrequency.BI_WEEKLY ||
         formData.payFrequency === PayFrequency.FOUR_WEEKLY) &&
        !formData.lastPayDate
      ) {
        Alert.alert('Required', 'Please enter your last pay date (YYYY-MM-DD).');
        return;
      }
      if (formData.payFrequency === PayFrequency.MONTHLY_SPECIFIC_DATE && !formData.payDayOfMonth) {
        Alert.alert('Required', 'Please enter your pay day (1-31).');
        return;
      }
    }
    if (step === 5 && !formData.baseIncome) {
      Alert.alert('Required', 'Please enter your base income.');
      return;
    }

    if (step < 5) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!user) {
      Alert.alert('Error', 'No user found. Please log in again.');
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        email: user.email || '',
        displayName: formData.displayName,
        preferences: {
          currencyCode: formData.currencyCode,
          currencySymbol: formData.currencySymbol,
        },
        financialSettings: {
          baseIncome: parseFloat(formData.baseIncome),
          payFrequency: formData.payFrequency,
          lastPayDate: formData.lastPayDate || null,
          payDayOfMonth: formData.payDayOfMonth ? parseInt(formData.payDayOfMonth.toString(), 10) : null,
        },
      };

      await createUserProfile(user.uid, profileData);
      console.log('Onboarding Data Saved:', formData);
      await checkProfile();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Welcome!</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>What should we call you?</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
        placeholder="Display Name"
        placeholderTextColor={colors.textSecondary}
        value={formData.displayName}
        onChangeText={(text) => updateForm('displayName', text)}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Currency</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Set your primary currency.</Text>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Currency Code (e.g., USD, GBP)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="GBP"
          placeholderTextColor={colors.textSecondary}
          value={formData.currencyCode}
          onChangeText={(text) => updateForm('currencyCode', text.toUpperCase())}
          maxLength={3}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Currency Symbol (e.g., $, £)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="£"
          placeholderTextColor={colors.textSecondary}
          value={formData.currencySymbol}
          onChangeText={(text) => updateForm('currencySymbol', text)}
          maxLength={1}
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Pay Frequency</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>How often do you get paid?</Text>
      <ScrollView style={styles.optionsList}>
        {Object.values(PayFrequency).map((freq) => (
          <TouchableOpacity
            key={freq}
            style={[
              styles.optionButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              formData.payFrequency === freq && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => updateForm('payFrequency', freq)}
          >
            <Text
              style={[
                styles.optionText,
                { color: colors.text },
                formData.payFrequency === freq && { color: '#fff', fontWeight: '600' },
              ]}
            >
              {freq.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderStep4 = () => {
    const isDateBased = [
      PayFrequency.WEEKLY,
      PayFrequency.BI_WEEKLY,
      PayFrequency.FOUR_WEEKLY,
    ].includes(formData.payFrequency);

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Cycle Anchor</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Lets set up your pay cycle.</Text>

        {isDateBased && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Last Pay Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder="2023-12-25"
              placeholderTextColor={colors.textSecondary}
              value={formData.lastPayDate}
              onChangeText={(text) => updateForm('lastPayDate', text)}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Format: YYYY-MM-DD</Text>
          </View>
        )}

        {formData.payFrequency === PayFrequency.MONTHLY_SPECIFIC_DATE && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Pay Day of Month (1-31)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder="25"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={formData.payDayOfMonth.toString()}
              onChangeText={(text) => updateForm('payDayOfMonth', text)}
              maxLength={2}
            />
          </View>
        )}

        {formData.payFrequency === PayFrequency.MONTHLY_LAST_WORKING_DAY && (
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              We will automatically calculate the last working day of each month for you.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.title, { color: colors.text }]}>Income</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>What is your base take-home pay per cycle?</Text>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Base Income</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="2000"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          value={formData.baseIncome}
          onChangeText={(text) => updateForm('baseIncome', text)}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${(step / 5) * 100}%`, backgroundColor: colors.primary }]} />
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <TouchableOpacity style={[styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={handleBack}>
              <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          
          <TouchableOpacity
            style={[styles.buttonPrimary, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>
                {step === 5 ? 'Finish' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginBottom: 20,
    marginTop: 40,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  optionsList: {
    flex: 1,
  },
  optionButton: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  infoBox: {
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  infoText: {
    color: '#0d47a1',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 15,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
