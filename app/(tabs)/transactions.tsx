import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useThemeColor } from '../../src/hooks/useThemeColor';
import { deleteTransaction, subscribeToTransactions } from '../../src/services/transactionService';
import { Transaction } from '../../src/types';
import { groupTransactionsByDate } from '../../src/utils/transactionUtils';

const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
  switch (category.toLowerCase()) {
    case 'food':
      return 'fast-food';
    case 'transport':
      return 'car';
    case 'utilities':
      return 'flash';
    case 'entertainment':
      return 'game-controller';
    case 'shopping':
      return 'cart';
    case 'other':
      return 'ellipsis-horizontal';
    default:
      return 'pricetag';
  }
};

export default function TransactionsScreen() {
  const colors = useThemeColor();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Expenses' | 'Income'>('All');

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToTransactions(user.uid, (data) => {
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = (transactionId: string) => {
    const performDelete = async () => {
      if (user) {
        try {
          await deleteTransaction(user.uid, transactionId);
        } catch (error) {
          Alert.alert("Error", "Failed to delete transaction.");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to delete this transaction?")) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Transaction?",
        "Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const currencySymbol = userProfile?.preferences?.currencySymbol || '$';

  const sections = useMemo(() => {
    let filtered = transactions;
    if (filter === 'Expenses') {
      filtered = transactions.filter(t => t.type === 'expense');
    } else if (filter === 'Income') {
      filtered = transactions.filter(t => t.type === 'income');
    }
    return groupTransactionsByDate(filtered);
  }, [transactions, filter]);

  const renderItem = ({ item, index, section }: { item: Transaction, index: number, section: any }) => {
    const isLastItem = index === section.data.length - 1;
    
    return (
      <View style={[styles.rowContainer, { backgroundColor: colors.card }, !isLastItem && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity
          style={styles.itemContent}
          onPress={() => router.push({
            pathname: '/add-transaction',
            params: {
              id: item.id,
              amount: item.amount.toString(),
              category: item.category,
              note: item.note || '',
              date: item.date,
              type: item.type
            }
          })}
        >
          <View style={styles.leftSection}>
            <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
              <Ionicons name={getCategoryIcon(item.category)} size={24} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.merchantText, { color: colors.text }]}>{item.note || item.category}</Text>
              <Text style={[styles.categoryText, { color: colors.textSecondary }]}>{item.category}</Text>
            </View>
          </View>
          
          <Text style={[
            styles.amountText,
            { color: item.type === 'income' ? '#10B981' : colors.text }
          ]}>
            {item.type === 'income' ? '+' : ''}{currencySymbol}{item.amount.toFixed(2)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <View style={[styles.sectionHeaderContainer, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.responsiveContainer}>
        {/* Header Filters */}
        <View style={[styles.filterContainer, { backgroundColor: colors.background }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {(['All', 'Expenses', 'Income'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.border },
                  filter === f && { backgroundColor: colors.text }
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  filter === f && { color: colors.background }
                ]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={sections.length === 0 ? styles.emptyList : styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions found</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/add-transaction')}
              >
                <Text style={styles.addButtonText}>Add Transaction</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  responsiveContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1F2937',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionHeaderContainer: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
  },
  rowSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  merchantText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  categoryText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
