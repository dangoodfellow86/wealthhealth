import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useThemeColor } from '../hooks/useThemeColor';
import { addTransaction } from '../services/transactionService';
import { setIncomeOverride } from '../services/userService';
import { groupExpensesByCategory } from '../utils/chartLogic';

const { width } = Dimensions.get('window');

export const DashboardScreen = () => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColor();
  const router = useRouter();
  const { user } = useAuth();
  const {
    leftToSpend,
    baseIncome,
    currentCycle,
    progress,
    loading,
    error,
    refetch,
    currencyCode,
    transactions,
    totalSpent,
    userProfile
  } = useDashboardData();

  const [editIncomeModalVisible, setEditIncomeModalVisible] = useState(false);
  const [tempIncome, setTempIncome] = useState('');

  const handleEditIncome = () => {
    setTempIncome(baseIncome.toString());
    setEditIncomeModalVisible(true);
  };

  const handleSaveIncome = async () => {
    if (!user || !currentCycle) return;
    const amount = parseFloat(tempIncome);
    if (isNaN(amount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid number');
      return;
    }
    try {
      const cycleKey = format(currentCycle.startDate, 'yyyy-MM-dd');
      await setIncomeOverride(user.uid, cycleKey, amount);
      setEditIncomeModalVisible(false);
      refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to update income');
    }
  };

  const handleSweep = () => {
    Alert.alert(
      'Sweep to Savings',
      `Do you want to move ${new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(leftToSpend)} to savings?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sweep',
          onPress: async () => {
            if (!user) return;
            try {
              await addTransaction(user.uid, {
                amount: leftToSpend,
                type: 'expense',
                category: 'Savings',
                date: new Date().toISOString(),
                note: 'End of cycle sweep',
                accountId: 'default',
                isRecurringInstance: false
              });
              refetch();
              Alert.alert('Success', 'Swept to savings!');
            } catch (error) {
              Alert.alert('Error', 'Failed to sweep');
            }
          }
        }
      ]
    );
  };

  const chartData = groupExpensesByCategory(transactions);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Text style={[styles.retryText, { color: colors.primary }]} onPress={() => refetch()}>Tap to retry</Text>
      </View>
    );
  }

  const formattedStartDate = currentCycle ? format(currentCycle.startDate, 'MMM d') : '-';
  const formattedEndDate = currentCycle ? format(currentCycle.endDate, 'MMM d') : '-';

  // Determine color based on left to spend
  const isLow = leftToSpend < 0;
  const spendColor = isLow ? '#FF3B30' : '#34C759';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        <View style={styles.headerContainer}>
          <View>
            <Text style={[styles.greetingText, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.userNameText, { color: colors.text }]}>{userProfile?.displayName || user?.displayName || 'User'}</Text>
          </View>

          {/* Profile Avatar (Placeholder) */}
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={[styles.profileButton, { backgroundColor: colors.border }]}>
            <Text style={[styles.profileInitials, { color: colors.textSecondary }]}>
              {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : (user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Left to Spend Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Left to Spend</Text>
            <Text style={[styles.cycleDates, { color: colors.textSecondary }]}>{formattedStartDate} - {formattedEndDate}</Text>
          </View>
          
          <Text style={[styles.amount, { color: spendColor }]}>
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(leftToSpend)}
          </Text>

          <View style={[styles.incomeContainer, { borderTopColor: colors.border }]}>
            <Text style={[styles.incomeLabel, { color: colors.text }]}>Income:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.incomeValue, { color: colors.text }]}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(baseIncome)}
              </Text>
              <TouchableOpacity onPress={handleEditIncome} style={[styles.editButton, { backgroundColor: colors.border }]}>
                <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.primary }
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {Math.round(progress * 100)}% of disposable income spent
            </Text>
          </View>

          {leftToSpend > 0 && (
            <TouchableOpacity style={styles.sweepButton} onPress={handleSweep}>
              <Text style={styles.sweepButtonText}>Sweep Leftover to Savings</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.actionButtonSplit, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/add-transaction', params: { type: 'expense' } })}
          >
            <IconSymbol name="minus" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButtonSplit, { backgroundColor: '#10B981' }]}
            onPress={() => router.push({ pathname: '/add-transaction', params: { type: 'income' } })}
          >
            <IconSymbol name="plus" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Add Income</Text>
          </TouchableOpacity>
        </View>

        {/* Spending Breakdown Chart */}
        {chartData.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Spending Breakdown</Text>
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <PieChart
                data={chartData}
                donut
                radius={120}
                innerRadius={100}
                innerCircleColor={colors.card}
                centerLabelComponent={() => {
                  return (
                    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, color: colors.text, fontWeight: 'bold' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(totalSpent)}
                      </Text>
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>Spent</Text>
                    </View>
                  );
                }}
              />
            </View>

            {/* Legend */}
            <View style={styles.legendContainer}>
              {chartData.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendText, { color: colors.text }]}>{item.category}</Text>
                  </View>
                  <Text style={[styles.legendAmount, { color: colors.text }]}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(item.value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Manage Bills Button */}
        <TouchableOpacity
          style={[styles.manageButton, { backgroundColor: colors.card }]}
          onPress={() => router.push('/manage-bills')}
        >
          <Text style={[styles.manageButtonText, { color: colors.primary }]}>Manage Recurring Bills</Text>
        </TouchableOpacity>

        {/* Additional Info (Optional for now, but good for layout) */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your recurring bills are deducted from your base income to calculate your disposable income.
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={editIncomeModalVisible}
        onRequestClose={() => setEditIncomeModalVisible(false)}
      >
        <View style={styles.modalCenteredView}>
          <View style={[styles.modalView, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Income</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Override income for this cycle only.</Text>
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              onChangeText={setTempIncome}
              value={tempIncome}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={() => setEditIncomeModalVisible(false)}
              >
                <Text style={styles.textStyle}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSave]}
                onPress={handleSaveIncome}
              >
                <Text style={styles.textStyle}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8F9FA',
    paddingBottom: 100, // Add padding for FAB
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24, // Push the cards down
    paddingHorizontal: 4, // Align with the cards
  },
  greetingText: {
    fontSize: 20,
    color: '#9CA3AF', // Soft Grey
    marginBottom: 4,
  },
  userNameText: {
    fontSize: 24, // Big and bold
    fontWeight: '700',
    color: '#1F2937', // Dark Grey (or White if keeping dark mode)
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB', // Light grey background
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  cardTitle: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '600',
  },
  amount: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 24,
  },
  cycleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cycleLabel: {
    fontSize: 16,
    color: '#3A3A3C',
    fontWeight: '500',
  },
  cycleDates: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  incomeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  incomeLabel: {
    fontSize: 16,
    color: '#3A3A3C',
    fontWeight: '500',
  },
  incomeValue: {
    fontSize: 16,
    color: '#3A3A3C',
    marginRight: 10,
  },
  editButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 8,
  },
  sweepButton: {
    marginTop: 16,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  sweepButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'right',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 10,
  },
  retryText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  infoContainer: {
    padding: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  actionButtonSplit: {
    flex: 0.48,
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  manageButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  legendContainer: {
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#3A3A3C',
  },
  legendAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    width: '100%',
    borderColor: '#E5E5EA',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonCancel: {
    backgroundColor: '#FF3B30',
  },
  buttonSave: {
    backgroundColor: '#34C759',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
