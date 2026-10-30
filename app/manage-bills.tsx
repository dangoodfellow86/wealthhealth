import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useThemeColor } from '../src/hooks/useThemeColor';
import {
  addRecurringBill,
  deleteField,
  deleteRecurringBill,
  getRecurringBills,
  updateRecurringBill,
} from '../src/services/billService';
import { getUserProfile } from '../src/services/userService';
import { BillFrequency, RecurringItem } from '../src/types';

const FREQUENCIES: { label: string; value: BillFrequency }[] = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Annual', value: 'ANNUAL' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Bi-Weekly', value: 'BI_WEEKLY' },
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function ManageBillsScreen() {
  const colors = useThemeColor();
  const { user } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('USD');

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDay, setNewDay] = useState('');
  const [newFrequency, setNewFrequency] = useState<BillFrequency>('MONTHLY');
  const [newDueMonth, setNewDueMonth] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBills();
  }, [user]);

  const fetchBills = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [billsData, userProfile] = await Promise.all([
        getRecurringBills(user.uid),
        getUserProfile(user.uid),
      ]);
      setBills(billsData);
      if (userProfile?.preferences?.currencyCode) {
        setCurrencyCode(userProfile.preferences.currencyCode);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBill = async () => {
    if (!user) return;
    if (!newTitle || !newAmount) {
      Alert.alert('Error', 'Please enter a name and amount');
      return;
    }

    try {
      setAdding(true);
      const amount = parseFloat(newAmount);
      const day = newDay ? parseInt(newDay, 10) : undefined;
      const dueMonth = newDueMonth ? parseInt(newDueMonth, 10) : undefined;

      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid positive amount');
        setAdding(false);
        return;
      }

      if (day && (day < 1 || day > 31)) {
        Alert.alert('Error', 'Day of month must be between 1 and 31');
        setAdding(false);
        return;
      }

      if (dueMonth && (dueMonth < 1 || dueMonth > 12)) {
        Alert.alert('Error', 'Due month must be between 1 and 12');
        setAdding(false);
        return;
      }

      if (editingId) {
        // Update existing bill with clean payload (using deleteField for cleared properties)
        const updates: Record<string, any> = {
          title: newTitle,
          amount,
          frequency: newFrequency,
        };

        if (day) {
          updates.dayOfMonth = day;
        } else {
          updates.dayOfMonth = deleteField();
        }

        if ((newFrequency === 'ANNUAL' || newFrequency === 'QUARTERLY') && dueMonth) {
          updates.dueMonth = dueMonth;
        } else {
          updates.dueMonth = deleteField();
        }

        await updateRecurringBill(user.uid, editingId, updates);
        setBills(bills.map(b => (b.id === editingId ? {
          ...b,
          title: newTitle,
          amount,
          frequency: newFrequency,
          dayOfMonth: day || undefined,
          dueMonth: (newFrequency === 'ANNUAL' || newFrequency === 'QUARTERLY') ? dueMonth : undefined,
        } : b)));
        setEditingId(null);
      } else {
        // Add new bill with clean properties
        const newBill: Record<string, any> = {
          title: newTitle,
          amount,
          isActive: true,
          category: 'Bills',
          frequency: newFrequency,
        };
        if (day) newBill.dayOfMonth = day;
        if ((newFrequency === 'ANNUAL' || newFrequency === 'QUARTERLY') && dueMonth) {
          newBill.dueMonth = dueMonth;
        }

        const addedBill = await addRecurringBill(user.uid, newBill as Omit<RecurringItem, 'id'>);
        setBills([...bills, addedBill]);
      }

      // Reset form
      setNewTitle('');
      setNewAmount('');
      setNewDay('');
      setNewDueMonth('');
      setNewFrequency('MONTHLY');
    } catch (error) {
      Alert.alert('Error', `Failed to ${editingId ? 'update' : 'add'} bill`);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (item: RecurringItem) => {
    setNewTitle(item.title);
    setNewAmount(item.amount.toString());
    setNewDay(item.dayOfMonth ? item.dayOfMonth.toString() : '');
    setNewFrequency(item.frequency || 'MONTHLY');
    setNewDueMonth(item.dueMonth ? item.dueMonth.toString() : '');
    setEditingId(item.id);
  };

  const handleCancelEdit = () => {
    setNewTitle('');
    setNewAmount('');
    setNewDay('');
    setNewDueMonth('');
    setNewFrequency('MONTHLY');
    setEditingId(null);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!user) return;
    try {
      setBills(bills.map(b => (b.id === id ? { ...b, isActive: !currentStatus } : b)));
      await updateRecurringBill(user.uid, id, { isActive: !currentStatus });
    } catch (error) {
      Alert.alert('Error', 'Failed to update bill status');
      fetchBills();
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    Alert.alert(
      'Delete Bill',
      'Are you sure you want to delete this bill?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setBills(bills.filter(b => b.id !== id));
              await deleteRecurringBill(user.uid, id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete bill');
              fetchBills();
            }
          },
        },
      ]
    );
  };

  const formatSchedule = (item: RecurringItem) => {
    const freq = item.frequency || 'MONTHLY';
    let label = freq.charAt(0) + freq.slice(1).toLowerCase().replace('_', '-');
    if (freq === 'ANNUAL' && item.dueMonth) {
      label += ` in ${MONTH_NAMES[item.dueMonth - 1]}`;
    } else if (freq === 'QUARTERLY' && item.dueMonth) {
      label += ` from ${MONTH_NAMES[item.dueMonth - 1]}`;
    }
    if (item.dayOfMonth) {
      label += ` (Day ${item.dayOfMonth})`;
    }
    return label;
  };

  const renderItem = ({ item }: { item: RecurringItem }) => (
    <View style={styles.billItem}>
      <View style={styles.billInfo}>
        <Text style={styles.billTitle}>{item.title}</Text>
        <Text style={styles.billAmount}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(item.amount)}
        </Text>
        <View style={styles.scheduleBadge}>
          <Text style={styles.scheduleBadgeText}>{formatSchedule(item)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Switch
          value={item.isActive}
          onValueChange={() => handleToggleActive(item.id, item.isActive)}
          trackColor={{ false: '#767577', true: '#34C759' }}
        />
        <TouchableOpacity onPress={() => handleEdit(item)} style={[styles.editButton, { backgroundColor: '#EFF6FF' }]}>
          <Ionicons name="pencil-outline" size={20} color="#4F46E5" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Recurring Bills',
          headerStyle: { backgroundColor: '#F8F9FA' },
          headerTintColor: '#1F2937',
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={bills}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No recurring bills found.</Text>}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
      >
        <View style={styles.addSection}>
          <View style={styles.addHeaderRow}>
            <Text style={styles.addHeader}>{editingId ? 'Edit Bill' : 'Add New Bill'}</Text>
            {editingId && (
              <TouchableOpacity onPress={handleCancelEdit}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Frequency selector pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.freqScroll}>
            {FREQUENCIES.map(f => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setNewFrequency(f.value)}
                style={[
                  styles.freqPill,
                  newFrequency === f.value && styles.freqPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.freqPillText,
                    newFrequency === f.value && styles.freqPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Name (e.g. Netflix)"
              placeholderTextColor="#6B7280"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Amount"
              placeholderTextColor="#6B7280"
              value={newAmount}
              onChangeText={setNewAmount}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Day of Month (1-31)"
              placeholderTextColor="#6B7280"
              value={newDay}
              onChangeText={setNewDay}
              keyboardType="numeric"
            />

            {(newFrequency === 'ANNUAL' || newFrequency === 'QUARTERLY') && (
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Due Month (1-12)"
                placeholderTextColor="#6B7280"
                value={newDueMonth}
                onChangeText={setNewDueMonth}
                keyboardType="numeric"
              />
            )}

            <TouchableOpacity
              style={[styles.addButton, (!newTitle || !newAmount) && styles.disabledButton]}
              onPress={handleAddBill}
              disabled={!newTitle || !newAmount || adding}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>{editingId ? 'Update' : 'Add Bill'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    padding: 20,
    paddingBottom: 120,
  },
  billItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: 4,
  },
  scheduleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scheduleBadgeText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 40,
    fontSize: 16,
  },
  addSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  addHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  freqScroll: {
    marginBottom: 12,
  },
  freqPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  freqPillActive: {
    backgroundColor: '#4F46E5',
  },
  freqPillText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  freqPillTextActive: {
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
