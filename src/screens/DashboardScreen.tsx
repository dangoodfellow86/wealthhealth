import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  addPlannedExpense,
  convertPlannedToTransaction,
  deletePlannedExpense,
} from '../services/plannedExpenseService';
import { addTransaction } from '../services/transactionService';
import { setIncomeOverride } from '../services/userService';
import { PlannedExpense } from '../types';
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
    totalRecurring,
    pendingRecurring,
    currentCycle,
    progress,
    loading,
    error,
    refetch,
    currencyCode,
    transactions,
    plannedExpenses,
    totalPlanned,
    totalSpent,
    userProfile,
    daysRemaining,
    safeDailyAllowance,
    cycleOffset,
    billMode,
    setBillMode,
    navigateCycle,
    resetToCurrentCycle,
  } = useDashboardData();

  // Edit Income Modal State
  const [editIncomeModalVisible, setEditIncomeModalVisible] = useState(false);
  const [tempIncome, setTempIncome] = useState('');

  // Plan Expense Modal State
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planCategory, setPlanCategory] = useState('Other');
  const [savingPlan, setSavingPlan] = useState(false);

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

  const handleOpenPlanModal = () => {
    setPlanTitle('');
    setPlanAmount('');
    setPlanCategory('Other');
    setPlanDate(currentCycle ? format(currentCycle.startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setPlanModalVisible(true);
  };

  const handleSavePlannedExpense = async () => {
    if (!user) return;
    if (!planTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for the planned expense');
      return;
    }
    const amount = parseFloat(planAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setSavingPlan(true);
      await addPlannedExpense(user.uid, {
        title: planTitle.trim(),
        amount,
        targetDate: planDate,
        category: planCategory,
      });
      setPlanModalVisible(false);
      refetch();
    } catch (err) {
      Alert.alert('Error', 'Failed to save planned expense');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleConvertPlanned = (item: PlannedExpense) => {
    Alert.alert(
      'Log as Paid',
      `Move "${item.title}" (${new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(item.amount)}) to logged expenses?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Expense',
          onPress: async () => {
            if (!user) return;
            try {
              await convertPlannedToTransaction(user.uid, item);
              refetch();
            } catch (err) {
              Alert.alert('Error', 'Failed to log expense');
            }
          },
        },
      ]
    );
  };

  const handleDeletePlanned = (id: string) => {
    Alert.alert('Remove Earmark', 'Are you sure you want to delete this planned expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await deletePlannedExpense(user.uid, id);
            refetch();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete planned expense');
          }
        },
      },
    ]);
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
                isRecurringInstance: false,
              });
              refetch();
              Alert.alert('Success', 'Swept to savings!');
            } catch (error) {
              Alert.alert('Error', 'Failed to sweep');
            }
          },
        },
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

  if (loading && !currentCycle) {
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
        <Text style={[styles.retryText, { color: colors.primary }]} onPress={() => refetch()}>
          Tap to retry
        </Text>
      </View>
    );
  }

  const formattedStartDate = currentCycle ? format(currentCycle.startDate, 'MMM d') : '-';
  const formattedEndDate = currentCycle ? format(currentCycle.endDate, 'MMM d') : '-';

  const isLow = leftToSpend < 0;
  const spendColor = isLow ? '#FF3B30' : '#34C759';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 20 },
        ]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.text} />
        }
      >
        <View style={styles.headerContainer}>
          <View>
            <Text style={[styles.greetingText, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.userNameText, { color: colors.text }]}>
              {userProfile?.displayName || user?.displayName || 'User'}
            </Text>
          </View>

          {/* Profile Avatar */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.profileButton, { backgroundColor: colors.border }]}
          >
            <Text style={[styles.profileInitials, { color: colors.textSecondary }]}>
              {userProfile?.displayName
                ? userProfile.displayName.charAt(0).toUpperCase()
                : user?.displayName
                ? user.displayName.charAt(0).toUpperCase()
                : 'U'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cycle Navigation Bar */}
        <View style={[styles.cycleNavCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigateCycle(-1)}
            style={[styles.cycleNavButton, { backgroundColor: colors.border }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="chevron.left" size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.cycleNavCenter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[styles.cycleNavTitle, { color: colors.text }]}>
                {cycleOffset === 0
                  ? 'Current Cycle'
                  : cycleOffset > 0
                  ? `Next Cycle (+${cycleOffset})`
                  : `Past Cycle (${cycleOffset})`}
              </Text>
              {cycleOffset !== 0 && (
                <TouchableOpacity onPress={resetToCurrentCycle} style={[styles.todayPill, { backgroundColor: colors.primary }]}>
                  <Text style={styles.todayPillText}>Today</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.cycleNavDates, { color: colors.textSecondary }]}>
              {formattedStartDate} – {formattedEndDate}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigateCycle(1)}
            style={[styles.cycleNavButton, { backgroundColor: colors.border }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="chevron.right" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Left to Spend Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
              {cycleOffset > 0 ? 'Projected Left to Spend' : cycleOffset < 0 ? 'Historical Left to Spend' : 'Left to Spend'}
            </Text>
            <Text style={[styles.cycleDates, { color: colors.textSecondary }]}>
              {formattedStartDate} - {formattedEndDate}
            </Text>
          </View>

          {/* Bill Deduction Mode Toggle */}
          <View style={[styles.billModeToggleContainer, { backgroundColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setBillMode('reserved')}
              style={[
                styles.billModePill,
                billMode === 'reserved' && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 1 },
              ]}
            >
              <Text style={[styles.billModePillText, { color: billMode === 'reserved' ? colors.primary : colors.textSecondary }]}>
                Reserved (All Bills)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setBillMode('pending')}
              style={[
                styles.billModePill,
                billMode === 'pending' && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 1 },
              ]}
            >
              <Text style={[styles.billModePillText, { color: billMode === 'pending' ? colors.primary : colors.textSecondary }]}>
                Cashflow (Pending Only)
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.amount, { color: spendColor }]}>
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(leftToSpend)}
          </Text>

          <View style={[styles.dailyAllowanceBadge, { backgroundColor: isLow ? '#FF3B3015' : '#34C75915' }]}>
            <Text style={[styles.dailyAllowanceText, { color: spendColor }]}>
              {cycleOffset < 0
                ? 'Cycle concluded'
                : cycleOffset > 0
                ? `Projected daily budget: `
                : `Safe daily budget: `}
              {cycleOffset >= 0 && (
                <Text style={{ fontWeight: '700' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(safeDailyAllowance)} / day
                </Text>
              )}
            </Text>
            {cycleOffset >= 0 && (
              <Text style={[styles.dailyAllowanceSubtext, { color: colors.textSecondary }]}>
                {cycleOffset === 0
                  ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining in cycle`
                  : `${daysRemaining} days in scheduled period`}
              </Text>
            )}
          </View>

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

          {(billMode === 'reserved' ? totalRecurring : pendingRecurring) > 0 && (
            <View style={[styles.incomeContainer, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.incomeLabel, { color: colors.text }]}>
                  {billMode === 'reserved' ? 'Bills (All Reserved):' : 'Bills (Pending):'}
                </Text>
                {billMode === 'pending' && totalRecurring > pendingRecurring && (
                  <Text style={{ fontSize: 11, color: '#10B981', marginTop: 2 }}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(totalRecurring - pendingRecurring)} already cleared
                  </Text>
                )}
              </View>
              <Text style={[styles.incomeValue, { color: '#EF4444', fontWeight: '700' }]}>
                -{new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(billMode === 'reserved' ? totalRecurring : pendingRecurring)}
              </Text>
            </View>
          )}

          {totalPlanned > 0 && (
            <View style={[styles.incomeContainer, { borderTopColor: colors.border }]}>
              <Text style={[styles.incomeLabel, { color: colors.text }]}>Earmarks Reserved:</Text>
              <Text style={[styles.incomeValue, { color: '#F59E0B', fontWeight: '700' }]}>
                -{new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(totalPlanned)}
              </Text>
            </View>
          )}

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.primary },
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

        {/* Planned Expenses (Earmarks) Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Planned Earmarks</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {cycleOffset > 0 ? 'Budget reserved for future planning' : 'Upcoming expenses reserved this cycle'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleOpenPlanModal}
              style={[styles.addEarmarkButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.addEarmarkButtonText}>+ Plan</Text>
            </TouchableOpacity>
          </View>

          {plannedExpenses.length === 0 ? (
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontStyle: 'italic', marginVertical: 8 }}>
              No earmarks planned for this cycle.
            </Text>
          ) : (
            plannedExpenses.map(item => (
              <View key={item.id} style={[styles.earmarkItem, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.earmarkTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {item.targetDate} • {item.category}
                  </Text>
                </View>

                <Text style={[styles.earmarkAmount, { color: colors.text }]}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(item.amount)}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 6 }}>
                  {cycleOffset === 0 && (
                    <TouchableOpacity
                      onPress={() => handleConvertPlanned(item)}
                      style={[styles.actionIconPill, { backgroundColor: '#10B98120' }]}
                    >
                      <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700' }}>Paid</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDeletePlanned(item.id)}
                    style={[styles.actionIconPill, { backgroundColor: '#FF3B3020' }]}
                  >
                    <Text style={{ fontSize: 11, color: '#FF3B30', fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
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
                centerLabelComponent={() => (
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, color: colors.text, fontWeight: 'bold' }}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(totalSpent)}
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>Spent</Text>
                  </View>
                )}
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

        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your recurring bills and planned earmarks are deducted to calculate disposable income for each pay cycle.
          </Text>
        </View>
      </ScrollView>

      {/* Edit Income Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editIncomeModalVisible}
        onRequestClose={() => setEditIncomeModalVisible(false)}
      >
        <View style={styles.modalCenteredView}>
          <View style={[styles.modalView, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Income</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Override income for this cycle only.
            </Text>

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

      {/* Plan Expense Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={planModalVisible}
        onRequestClose={() => setPlanModalVisible(false)}
      >
        <View style={styles.modalCenteredView}>
          <View style={[styles.modalView, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Plan Future Expense</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Reserve budget in this cycle for an upcoming expense.
            </Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              onChangeText={setPlanTitle}
              value={planTitle}
              placeholder="Title (e.g. Car Insurance)"
              placeholderTextColor={colors.textSecondary}
            />

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              onChangeText={setPlanAmount}
              value={planAmount}
              keyboardType="numeric"
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
            />

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              onChangeText={setPlanDate}
              value={planDate}
              placeholder="Target Date (YYYY-MM-DD)"
              placeholderTextColor={colors.textSecondary}
            />

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              onChangeText={setPlanCategory}
              value={planCategory}
              placeholder="Category (e.g. Travel, Auto, Home)"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={() => setPlanModalVisible(false)}
              >
                <Text style={styles.textStyle}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSave]}
                onPress={handleSavePlannedExpense}
                disabled={savingPlan}
              >
                <Text style={styles.textStyle}>{savingPlan ? 'Saving...' : 'Add Earmark'}</Text>
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
    paddingBottom: 100,
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
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  userNameText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  cycleNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cycleNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleNavCenter: {
    alignItems: 'center',
    flex: 1,
  },
  cycleNavTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cycleNavDates: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  todayPill: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  billModeToggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  billModePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billModePillText: {
    fontSize: 12,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  dailyAllowanceBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  dailyAllowanceText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dailyAllowanceSubtext: {
    fontSize: 12,
    marginTop: 2,
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
    marginTop: 10,
    marginBottom: 20,
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButtonSplit: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addEarmarkButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addEarmarkButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  earmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  earmarkTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  earmarkAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionIconPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 48,
    width: '100%',
    borderColor: '#E5E5EA',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    elevation: 2,
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
    fontSize: 15,
  },
});
