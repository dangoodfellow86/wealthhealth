import { useAuth } from '@/src/context/AuthContext';
import { auth } from '@/src/firebaseConfig';
import { useThemeColor } from '@/src/hooks/useThemeColor';
import { updateUserProfile } from '@/src/services/userService';
import { PayFrequency, UserProfile } from '@/src/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { user, userProfile, checkProfile } = useAuth();
  const colors = useThemeColor();

  const [displayName, setDisplayName] = useState('');
  const [baseIncome, setBaseIncome] = useState('');
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(PayFrequency.MONTHLY_SPECIFIC_DATE);
  const [payDayAnchor, setPayDayAnchor] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBaseIncome(userProfile.financialSettings.baseIncome.toString() || '');
      setPayFrequency(userProfile.financialSettings.payFrequency);

      if (userProfile.financialSettings.lastPayDate) {
        setPayDayAnchor(new Date(userProfile.financialSettings.lastPayDate));
      } else if (userProfile.financialSettings.payDayOfMonth) {
        const now = new Date();
        const date = new Date(now.getFullYear(), now.getMonth(), userProfile.financialSettings.payDayOfMonth);
        setPayDayAnchor(date);
      }
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const income = parseFloat(baseIncome);
      if (isNaN(income)) {
        Alert.alert('Error', 'Please enter a valid base income');
        setIsSaving(false);
        return;
      }

      const updates: Partial<UserProfile> = {
        displayName,
        financialSettings: {
          ...userProfile?.financialSettings,
          baseIncome: income,
          payFrequency,
          // Reset anchors first
          lastPayDate: null,
          payDayOfMonth: null,
        } as any, // Type assertion needed because we are merging
      };

      // Set the correct anchor based on frequency
      if (
        payFrequency === PayFrequency.WEEKLY ||
        payFrequency === PayFrequency.BI_WEEKLY ||
        payFrequency === PayFrequency.FOUR_WEEKLY
      ) {
        updates.financialSettings!.lastPayDate = payDayAnchor.toISOString().split('T')[0];
      } else if (payFrequency === PayFrequency.MONTHLY_SPECIFIC_DATE) {
        updates.financialSettings!.payDayOfMonth = payDayAnchor.getDate();
      }
      // MONTHLY_LAST_WORKING_DAY doesn't need an anchor

      await updateUserProfile(user.uid, updates);
      await checkProfile(); // Refresh context
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setPayDayAnchor(selectedDate);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Personal Information</Text>
          
          <Text style={[styles.label, { color: colors.textSecondary }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Financial Settings</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Base Income</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            value={baseIncome}
            onChangeText={setBaseIncome}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Pay Frequency</Text>
          <View style={[styles.pickerContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Picker
              selectedValue={payFrequency}
              onValueChange={(itemValue) => setPayFrequency(itemValue)}
              style={{ color: colors.text }}
              dropdownIconColor={colors.text}
            >
              <Picker.Item label="Weekly" value={PayFrequency.WEEKLY} color={colors.text} style={{ backgroundColor: colors.card }} />
              <Picker.Item label="Bi-Weekly (Every 2 weeks)" value={PayFrequency.BI_WEEKLY} color={colors.text} style={{ backgroundColor: colors.card }} />
              <Picker.Item label="Four-Weekly (Every 4 weeks)" value={PayFrequency.FOUR_WEEKLY} color={colors.text} style={{ backgroundColor: colors.card }} />
              <Picker.Item label="Monthly (Specific Date)" value={PayFrequency.MONTHLY_SPECIFIC_DATE} color={colors.text} style={{ backgroundColor: colors.card }} />
              <Picker.Item label="Monthly (Last Working Day)" value={PayFrequency.MONTHLY_LAST_WORKING_DAY} color={colors.text} style={{ backgroundColor: colors.card }} />
            </Picker>
          </View>

          {payFrequency !== PayFrequency.MONTHLY_LAST_WORKING_DAY && (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {payFrequency === PayFrequency.MONTHLY_SPECIFIC_DATE ? 'Pay Day of Month' : 'Last Pay Date'}
              </Text>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {payFrequency === PayFrequency.MONTHLY_SPECIFIC_DATE
                    ? `Day ${payDayAnchor.getDate()}`
                    : payDayAnchor.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={payDayAnchor}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
    marginTop: 40,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  button: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButton: {
    backgroundColor: '#4F46E5',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
