import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';
import Constants from 'expo-constants';
import { signOut } from '../services/authService';
import { useMealStore } from '../store/useMealStore';
import { useTheme } from '../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { isHealthKitEnabled } from '../utils/healthKitSettings';
import { Platform } from 'react-native';
import { getLocalDateString } from '../utils/dateUtils';

const MEAL_TYPE_ICONS: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  Breakfast: 'sunny-outline',
  Lunch: 'partly-sunny-outline',
  Dinner: 'moon-outline',
  Snack: 'nutrition-outline',
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const [currentDate] = useState(new Date());
  const { colors, isDark } = useTheme();
  const [healthKitEnabled, setHealthKitEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      isHealthKitEnabled().then(setHealthKitEnabled).catch(() => {});
    }
  }, []);

  // Get app version
  const appVersion = Constants.expoConfig?.version || 'dev';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '-';

  // Get real meal data from store
  const { meals, dailySummary, calorieGoal, proteinGoal, updateDailySummary, deleteMeal } = useMealStore();

  // Update summary when screen loads or meals change
  useEffect(() => {
    updateDailySummary();
  }, [meals]);

  // Calculate values from real data
  const caloriesConsumed = dailySummary?.totalCalories || 0;
  const caloriesLeft = calorieGoal - caloriesConsumed;
  const percentage = Math.round((caloriesConsumed / calorieGoal) * 100);

  const macros = {
    protein: {
      current: Math.round(dailySummary?.totalProtein || 0),
      goal: proteinGoal
    },
    carbs: {
      current: Math.round(dailySummary?.totalCarbs || 0),
      goal: Math.round(calorieGoal * 0.5 / 4) // 50% of calories from carbs
    },
    fat: {
      current: Math.round(dailySummary?.totalFat || 0),
      goal: Math.round(calorieGoal * 0.3 / 9) // 30% of calories from fat
    },
  };

  // Get today's meals grouped by type
  const today = getLocalDateString();
  const todayMeals = meals.filter(meal => getLocalDateString(new Date(meal.timestamp)) === today);

  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = () => {
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getProgressColor = () => {
    if (percentage > 100) return colors.error; // Red - over goal
    if (percentage > 80) return colors.warning; // Orange - warning
    return colors.success; // Green - on track
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleQuickAdd = (type: string) => {
    if (type === 'photo') {
      navigation.navigate('Camera' as never);
    } else if (type === 'barcode') {
      navigation.navigate('BarcodeScanner' as never);
    } else if (type === 'manual') {
      // Navigate directly to food search for better UX
      navigation.navigate('FoodSearch' as never);
    } else if (type === 'voice') {
      navigation.navigate('VoiceLog' as never);
    }
  };

  const handleDeleteMeal = (mealId: string, mealType: string) => {
    Alert.alert(
      'Delete Meal',
      `Are you sure you want to delete this ${mealType}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMeal(mealId);
          },
        },
      ]
    );
  };

  const handleEditMeal = (meal: any) => {
    // Convert meal foods to FoodRecognitionResult format
    const result = {
      foods: meal.foods.map((food: any) => ({
        name: food.name,
        calories: food.calories / (food.quantity || 1), // Per-item calories
        protein_g: food.protein_g / (food.quantity || 1),
        carbs_g: food.carbs_g / (food.quantity || 1),
        fat_g: food.fat_g / (food.quantity || 1),
        serving_size: food.portion || '1 serving',
        confidence: 1.0,
      })),
      image_url: '',
    };

    navigation.navigate('FoodResults' as never, {
      result,
      existingMealId: meal.id,
      existingMealType: meal.mealType,
    } as never);
  };

  const renderRightActions = (mealId: string, mealType: string) => {
    return (
      <View style={styles.swipeDeleteContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteMeal(mealId, mealType)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: colors.background,
    },
    appLogo: {
      width: 32,
      height: 32,
      borderRadius: 8,
    },
    signOutButton: {
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    signOutText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    greetingSection: {
      paddingHorizontal: 20,
      marginTop: 8,
      marginBottom: 20,
    },
    greeting: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    date: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 3,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    progressCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 20,
      padding: 24,
      marginBottom: 24,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 12,
      elevation: isDark ? 0 : 3,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
    },
    calorieText: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1,
    },
    calorieGoal: {
      fontSize: 16,
      color: colors.textTertiary,
    },
    percentageText: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 2,
      letterSpacing: 0.2,
    },
    caloriesLeftLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 8,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    calorieSourceNote: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    macroLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      width: 60,
    },
    macroValue: {
      fontSize: 13,
      color: colors.textTertiary,
      marginRight: 10,
    },
    macroBar: {
      flex: 1,
      height: 3,
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : colors.divider,
      borderRadius: 2,
      overflow: 'hidden',
    },
    sectionHeader: {
      paddingHorizontal: 20,
      marginBottom: 12,
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.primary,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    quickAddContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 20,
      marginBottom: 24,
      gap: 8,
    },
    quickAddButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
      gap: 6,
    },
    quickAddText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    mealCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
    },
    mealType: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    mealCalories: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    foodName: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
    },
    addMealButton: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginTop: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    addMealText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    emptyStateText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
    },
    caloriesLeft: {
      fontSize: 44,
      fontWeight: '800',
      marginBottom: 24,
      letterSpacing: -2,
    },
    foodCalories: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    foodBullet: {
      fontSize: 14,
      color: colors.textTertiary,
      marginRight: 8,
    },
    versionContainer: {
      alignItems: 'center',
      paddingVertical: 20,
      marginTop: 20,
    },
    versionText: {
      fontSize: 11,
      color: colors.textTertiary,
      fontFamily: 'monospace',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={dynamicStyles.header}>
        <Image
          source={require('../../assets/icon.png')}
          style={dynamicStyles.appLogo}
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            testID="home-achievements"
            accessibilityLabel="Achievements"
            onPress={() => navigation.navigate('Achievements' as never)}
            style={[dynamicStyles.signOutButton, { marginRight: 0 }]}
          >
            <Ionicons name="trophy" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-exercise"
            accessibilityLabel="Exercise"
            onPress={() => navigation.navigate('Exercise' as never)}
            style={[dynamicStyles.signOutButton, { marginRight: 0 }]}
          >
            <Ionicons name="fitness" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-mealhistory"
            accessibilityLabel="Meal history"
            onPress={() => navigation.navigate('MealHistory' as never)}
            style={[dynamicStyles.signOutButton, { marginRight: 0 }]}
          >
            <Ionicons name="calendar" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-progress"
            accessibilityLabel="Progress"
            onPress={() => navigation.navigate('Progress' as never)}
            style={[dynamicStyles.signOutButton, { marginRight: 0 }]}
          >
            <Ionicons name="stats-chart" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-settings"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate('Settings' as never)}
            style={[dynamicStyles.signOutButton, { marginRight: 0 }]}
          >
            <Ionicons name="settings" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={dynamicStyles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={dynamicStyles.greetingSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={dynamicStyles.greeting}>{getGreeting()}</Text>
          </View>
          <Text style={dynamicStyles.date}>{formatDate()}</Text>
        </View>

        {/* Calorie Progress Card */}
        <View style={dynamicStyles.progressCard}>
          {healthKitEnabled && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              marginBottom: 16,
              alignSelf: 'center'
            }}>
              <Ionicons name="heart" size={14} color="#FF2D55" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>
                LINKED WITH APPLE HEALTH
              </Text>
            </View>
          )}
          <View style={styles.calorieRing}>
            {/* SVG Circle Progress */}
            <Svg width="200" height="200" style={styles.svgContainer}>
              {/* Background Circle */}
              <Circle
                cx="100"
                cy="100"
                r="86"
                stroke={isDark ? 'rgba(255,255,255,0.07)' : colors.divider}
                strokeWidth="8"
                fill="none"
              />
              {/* Progress Circle */}
              <Circle
                cx="100"
                cy="100"
                r="86"
                stroke={getProgressColor()}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 86}`}
                strokeDashoffset={`${2 * Math.PI * 86 * (1 - Math.min(percentage, 100) / 100)}`}
                strokeLinecap="round"
                rotation="-90"
                origin="100, 100"
              />
            </Svg>

            {/* Center Text Overlay */}
            <View style={styles.centerTextContainer}>
              <Text style={dynamicStyles.calorieText}>
                {caloriesConsumed}
                <Text style={dynamicStyles.calorieGoal}> / {calorieGoal}</Text>
              </Text>
              <Text style={dynamicStyles.percentageText}>{percentage}%</Text>
            </View>
          </View>

          <Text style={dynamicStyles.caloriesLeftLabel}>Calories Left</Text>
          <Text style={[dynamicStyles.caloriesLeft, { color: getProgressColor() }]}>
            {caloriesLeft}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Sources' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginTop: -16, marginBottom: 20 }}
          >
            <Text style={dynamicStyles.calorieSourceNote}>
              Target per Mifflin–St Jeor · <Text style={{ color: colors.primary, textDecorationLine: 'underline' }}>Sources</Text>
            </Text>
          </TouchableOpacity>

          {/* Macro Progress */}
          <View style={styles.macrosContainer}>
            <View style={styles.macroRow}>
              <Text style={dynamicStyles.macroLabel}>Protein</Text>
              <Text style={dynamicStyles.macroValue}>
                {macros.protein.current}g / {macros.protein.goal}g
              </Text>
            </View>
            <View style={dynamicStyles.macroBar}>
              <View
                style={[
                  styles.macroProgress,
                  {
                    width: `${Math.min((macros.protein.current / macros.protein.goal) * 100, 100)}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>

            <View style={styles.macroRow}>
              <Text style={dynamicStyles.macroLabel}>Carbs</Text>
              <Text style={dynamicStyles.macroValue}>
                {macros.carbs.current}g / {macros.carbs.goal}g
              </Text>
            </View>
            <View style={dynamicStyles.macroBar}>
              <View
                style={[
                  styles.macroProgress,
                  {
                    width: `${Math.min((macros.carbs.current / macros.carbs.goal) * 100, 100)}%`,
                    backgroundColor: colors.success,
                  },
                ]}
              />
            </View>

            <View style={styles.macroRow}>
              <Text style={dynamicStyles.macroLabel}>Fat</Text>
              <Text style={dynamicStyles.macroValue}>
                {macros.fat.current}g / {macros.fat.goal}g
              </Text>
            </View>
            <View style={dynamicStyles.macroBar}>
              <View
                style={[
                  styles.macroProgress,
                  {
                    width: `${Math.min((macros.fat.current / macros.fat.goal) * 100, 100)}%`,
                    backgroundColor: colors.warning,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Quick Add Section */}
        <View style={dynamicStyles.sectionHeader}>
          <View style={dynamicStyles.sectionDot} />
          <Text style={dynamicStyles.sectionTitle}>Log Food</Text>
        </View>
        <View style={dynamicStyles.quickAddContainer}>
          <TouchableOpacity style={dynamicStyles.quickAddButton} onPress={() => handleQuickAdd('photo')}>
            <Ionicons name="camera" size={24} color={colors.primary} />
            <Text style={dynamicStyles.quickAddText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.quickAddButton} onPress={() => handleQuickAdd('barcode')}>
            <Ionicons name="barcode" size={24} color={colors.primary} />
            <Text style={dynamicStyles.quickAddText}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.quickAddButton} onPress={() => handleQuickAdd('voice')}>
            <Ionicons name="mic" size={24} color={colors.primary} />
            <Text style={dynamicStyles.quickAddText}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.quickAddButton} onPress={() => handleQuickAdd('manual')}>
            <Ionicons name="create" size={24} color={colors.primary} />
            <Text style={dynamicStyles.quickAddText}>Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.quickAddButton} onPress={() => navigation.navigate('RecipeList' as never)}>
            <Ionicons name="restaurant" size={24} color={colors.primary} />
            <Text style={dynamicStyles.quickAddText}>Recipe</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Meals */}
        <View style={dynamicStyles.sectionHeader}>
          <View style={dynamicStyles.sectionDot} />
          <Text style={dynamicStyles.sectionTitle}>Today's Meals</Text>
        </View>

        {todayMeals.length === 0 ? (
          <View style={dynamicStyles.emptyState}>
            <Ionicons name="restaurant-outline" size={40} color={colors.textTertiary} style={{ marginBottom: 14 }} />
            <Text style={dynamicStyles.emptyStateText}>Nothing logged yet</Text>
            <Text style={dynamicStyles.emptyStateSubtext}>Use the log buttons above to add your first meal.</Text>
          </View>
        ) : (
          todayMeals.map((meal) => (
            <Swipeable
              key={meal.id}
              renderRightActions={() => renderRightActions(meal.id, meal.mealType)}
              overshootRight={false}
              rightThreshold={40}
            >
              <TouchableOpacity
                style={dynamicStyles.mealCard}
                onPress={() => handleEditMeal(meal)}
                activeOpacity={0.7}
              >
                <View style={styles.mealHeader}>
                  <View style={styles.mealTitleRow}>
                    <Ionicons
                      name={MEAL_TYPE_ICONS[meal.mealType as keyof typeof MEAL_TYPE_ICONS] || 'restaurant'}
                      size={20}
                      color={colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={dynamicStyles.mealType}>{meal.mealType}</Text>
                  </View>
                  <Text style={dynamicStyles.mealCalories}>{Math.round(meal.totalCalories)} cal</Text>
                </View>
                {meal.foods.map((food) => (
                  <View key={food.id} style={styles.foodItem}>
                    <Text style={dynamicStyles.foodBullet}>·</Text>
                    <Text style={dynamicStyles.foodName}>
                      {food.name} {food.quantity > 1 ? `(${food.quantity}x)` : ''}
                    </Text>
                    <Text style={dynamicStyles.foodCalories}>
                      {Math.round(food.calories * food.quantity)}
                    </Text>
                  </View>
                ))}
              </TouchableOpacity>
            </Swipeable>
          ))
        )}

        {/* Quick Add Meal Type Buttons */}
        {!todayMeals.some(m => m.mealType === 'Breakfast') && (
          <TouchableOpacity
            style={dynamicStyles.addMealButton}
            onPress={() => handleQuickAdd('photo')}
          >
            <Ionicons name="add" size={16} color={colors.textTertiary} />
            <Text style={dynamicStyles.addMealText}>Breakfast</Text>
          </TouchableOpacity>
        )}

        {!todayMeals.some(m => m.mealType === 'Lunch') && (
          <TouchableOpacity
            style={dynamicStyles.addMealButton}
            onPress={() => handleQuickAdd('photo')}
          >
            <Ionicons name="add" size={16} color={colors.textTertiary} />
            <Text style={dynamicStyles.addMealText}>Lunch</Text>
          </TouchableOpacity>
        )}

        {!todayMeals.some(m => m.mealType === 'Dinner') && (
          <TouchableOpacity
            style={dynamicStyles.addMealButton}
            onPress={() => handleQuickAdd('photo')}
          >
            <Ionicons name="add" size={16} color={colors.textTertiary} />
            <Text style={dynamicStyles.addMealText}>Dinner</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={dynamicStyles.addMealButton}
          onPress={() => handleQuickAdd('photo')}
        >
          <Ionicons name="add" size={16} color={colors.textTertiary} />
          <Text style={dynamicStyles.addMealText}>Snack</Text>
        </TouchableOpacity>


        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  greetingSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    color: '#6B7280',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  calorieRing: {
    marginBottom: 16,
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calorieText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  calorieGoal: {
    fontSize: 18,
    fontWeight: '400',
    color: '#6B7280',
  },
  percentageText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  caloriesLeftLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  caloriesLeft: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },
  macrosContainer: {
    width: '100%',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  macroValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  macroBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  macroProgress: {
    height: '100%',
    borderRadius: 3,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  quickAddContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  quickAddButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 100,
  },
  quickAddText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  mealCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  foodBullet: {
    fontSize: 16,
    color: '#9CA3AF',
    marginRight: 8,
  },
  foodName: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  foodCalories: {
    fontSize: 15,
    color: '#6B7280',
  },
  addMealButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addMealText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  swipeDeleteContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
