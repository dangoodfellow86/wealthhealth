# Plan: Replace FAB with Quick Actions on Dashboard

## Objective
Replace the floating action button (FAB) on the Dashboard with a row of "Quick Actions" to improve usability and accessibility of common tasks.

## Steps

### 1. Update Icon Mappings
**File:** `components/ui/icon-symbol.tsx`
- Add the following mappings to the `MAPPING` object:
  - `'minus': 'remove'`
  - `'plus': 'add'`
  - `'pencil': 'edit'`
  - `'bag': 'shopping-bag'`

### 2. Update Add Transaction Screen
**File:** `app/add-transaction.tsx`
- Import `useLocalSearchParams` from `expo-router`.
- Retrieve the `type` parameter from the URL (default to `'expense'` if not present).
- Update the `handleSave` function to use the retrieved `type` instead of hardcoding `'expense'`.
- (Optional) Update the screen title or button text to reflect the transaction type (e.g., "Add Income" vs "Add Expense").

### 3. Modify Dashboard Screen
**File:** `src/screens/DashboardScreen.tsx`
- **Remove FAB:** Delete the `TouchableOpacity` with `styles.fab` and the corresponding styles.
- **Remove Old Manage Button:** Delete the "Manage Recurring Bills" button (optional, but recommended to avoid redundancy).
- **Insert Quick Actions Row:**
  - Create a container `View` with `flexDirection: 'row'`, `justifyContent: 'space-between'`, and appropriate padding/margin.
  - Insert this row between the "Overview" card and the "Spending Breakdown" chart.
  - Add 4 buttons to the row:
    1.  **Add Expense**:
        - Icon: `minus`
        - Action: `router.push('/add-transaction?type=expense')`
        - Label: "Expense"
    2.  **Add Income**:
        - Icon: `plus`
        - Action: `router.push('/add-transaction?type=income')`
        - Label: "Income"
    3.  **Manage Bills**:
        - Icon: `bag`
        - Action: `router.push('/manage-bills')`
        - Label: "Bills"
    4.  **Edit Income**:
        - Icon: `pencil`
        - Action: `handleEditIncome()`
        - Label: "Edit" (or "Adjust")

### 4. Verification
- Verify that clicking each button navigates to the correct screen or performs the correct action.
- Verify that adding a transaction with `type=income` correctly saves it as an income transaction.
