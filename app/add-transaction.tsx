import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useThemeColor } from '../src/hooks/useThemeColor';
import { addTransaction, updateTransaction } from '../src/services/transactionService';

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Bonus', 'Gift', 'Freelance', 'Other'];

export default function AddTransactionScreen() {
  const colors = useThemeColor();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    type?: string;
    amount?: string;
    category?: string;
    note?: string;
    date?: string;
  }>();
  const { user } = useAuth();
  
  const isEditing = !!params.id;

  const [transactionType, setTransactionType] = useState<'income' | 'expense'>((params.type as 'income' | 'expense') || 'expense');
  const [amount, setAmount] = useState(params.amount ? params.amount.toString() : '');
  const [category, setCategory] = useState(params.category || (transactionType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]));
  const [note, setNote] = useState(params.note || '');
  const [date, setDate] = useState(params.date || new Date().toISOString());
  const [loading, setLoading] = useState(false);

  const currentCategories = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleTypeChange = (type: 'income' | 'expense') => {
    setTransactionType(type);
    setCategory(type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const transactionData = {
        amount: parseFloat(amount),
        category,
        note,
        date,
        type: transactionType,
        accountId: 'default', // Placeholder
        isRecurringInstance: false,
      };

      if (isEditing && params.id) {
        await updateTransaction(user.uid, params.id, transactionData);
      } else {
        await addTransaction(user.uid, transactionData);
      }
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{
        title: isEditing ? 'Edit Transaction' : 'Add Transaction',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Type Toggle */}
        <View style={[styles.typeToggleContainer, { backgroundColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.typeButton, transactionType === 'expense' && { backgroundColor: colors.card }]}
            onPress={() => handleTypeChange('expense')}
          >
            <Text style={[styles.typeButtonText, { color: colors.textSecondary }, transactionType === 'expense' && { color: colors.text, fontWeight: '600' }]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, transactionType === 'income' && { backgroundColor: colors.card }]}
            onPress={() => handleTypeChange('income')}
          >
            <Text style={[styles.typeButtonText, { color: colors.textSecondary }, transactionType === 'income' && { color: colors.text, fontWeight: '600' }]}>Income</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Amount</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Category</Text>
          <View style={styles.categoryContainer}>
            {currentCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  category === cat && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: colors.text },
                    category === cat && { color: '#fff', fontWeight: '600' },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Note (Optional)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="What was this for?"
            placeholderTextColor={colors.textSecondary}
            value={note}
            onChangeText={setNote}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Date (ISO)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            value={date}
            onChangeText={setDate}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Save Transaction'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  typeButtonSelected: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  typeButtonTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  amountInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
