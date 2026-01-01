import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
  deleteRecurringBill,
  getRecurringBills,
  updateRecurringBill,
} from '../src/services/billService';
import { getUserProfile } from '../src/services/userService';
import { RecurringItem } from '../src/types';

export default function ManageBillsScreen() {
  const colors = useThemeColor();
  const { user } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('USD');

  // New Bill Form State
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDay, setNewDay] = useState('');
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
        getUserProfile(user.uid)
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

      if (editingId) {
        // Update existing bill
        await updateRecurringBill(user.uid, editingId, {
          title: newTitle,
          amount,
          dayOfMonth: day,
        });
        
        setBills(bills.map(b => b.id === editingId ? { ...b, title: newTitle, amount, dayOfMonth: day } : b));
        setEditingId(null);
      } else {
        // Add new bill
        const newBill: Omit<RecurringItem, 'id'> = {
          title: newTitle,
          amount,
          isActive: true,
          category: 'Bills',
          dayOfMonth: day,
        };

        const addedBill = await addRecurringBill(user.uid, newBill);
        setBills([...bills, addedBill]);
      }
      
      // Reset form
      setNewTitle('');
      setNewAmount('');
      setNewDay('');
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
    setEditingId(item.id);
  };

  const handleCancelEdit = () => {
    setNewTitle('');
    setNewAmount('');
    setNewDay('');
    setEditingId(null);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!user) return;
    try {
      // Optimistic update
      setBills(bills.map(b => b.id === id ? { ...b, isActive: !currentStatus } : b));
      await updateRecurringBill(user.uid, id, { isActive: !currentStatus });
    } catch (error) {
      Alert.alert('Error', 'Failed to update bill status');
      // Revert on error
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

  const renderItem = ({ item }: { item: RecurringItem }) => (
    <View style={styles.billItem}>
      <View style={styles.billInfo}>
        <Text style={styles.billTitle}>{item.title}</Text>
        <Text style={styles.billDetails}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(item.amount)}
          {item.dayOfMonth ? ` • Day ${item.dayOfMonth}` : ''}
        </Text>
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
              placeholder="Day (Optional)"
              placeholderTextColor="#6B7280"
              value={newDay}
              onChangeText={setNewDay}
              keyboardType="numeric"
            />
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
    paddingBottom: 100,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1F2937',
  },
  billDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 40,
  },
  addSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  addHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  cancelText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  disabledButton: {
    backgroundColor: '#93C5FD',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
