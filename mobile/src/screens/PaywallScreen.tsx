import { trackCustomEvent } from '../utils/analytics';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PACKAGE_TYPE } from 'react-native-purchases';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

const C = {
  bg: '#0A0A0C',
  surface: '#1A1A1E',
  elevated: '#222228',
  modal: '#2A2A32',
  text: '#F0F0F5',
  textSub: '#A0A0B0',
  textTertiary: '#6B6B80',
  accent: '#00E676',
  accentBg: 'rgba(0,230,118,0.12)',
  gold: '#FCD34D',
  border: 'rgba(255,255,255,0.08)',
  borderAccent: 'rgba(0,230,118,0.25)',
};

const BENEFITS = [
  { icon: 'flash', text: 'Never wonder what to eat again', sub: 'AI builds your meal plan around your macros' },
  { icon: 'time', text: 'Log any meal in under 30 seconds', sub: 'Camera scan, voice, or search — your choice' },
  { icon: 'body-outline', text: 'Personalised to your body', sub: 'Macros calculated from your height, weight, age and goals' },
  { icon: 'shield-checkmark', text: 'Cancel anytime — no commitment', sub: '7 days free, cancel in Settings before it ends' },
];

const getTrialEndDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

export default function PaywallScreen() {
  const navigation = useNavigation();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly' | 'lifetime'>('annual');
  const [offeringLoading, setOfferingLoading] = useState(false);
  const { offering, isPurchasing, purchase, restore, loadOffering } = useSubscriptionStore();
  const trialEndDate = getTrialEndDate();

  useEffect(() => {
    trackCustomEvent('paywall_view', { has_offering: offering ? 1 : 0 }).catch(() => {});
    if (!offering) {
      setOfferingLoading(true);
      loadOffering().finally(() => setOfferingLoading(false));
    }
  }, []);

  const annualPkg = offering?.availablePackages.find(p => p.packageType === PACKAGE_TYPE.ANNUAL);
  const monthlyPkg = offering?.availablePackages.find(p => p.packageType === PACKAGE_TYPE.MONTHLY);
  const lifetimePkg = offering?.availablePackages.find(p => p.packageType === PACKAGE_TYPE.LIFETIME);

  // Displayed prices — use real prices from RC, fall back to static
  const annualMonthly = annualPkg
    ? `$${(annualPkg.product.price / 12).toFixed(2)}`
    : '$4.17';
  const annualFull = annualPkg?.product.priceString ?? '$49.99';
  const monthlyPrice = monthlyPkg?.product.priceString ?? '$9.99';
  const lifetimePrice = lifetimePkg?.product.priceString ?? '';
  // Savings vs paying monthly for a year, from the real store prices
  const annualSavePct = annualPkg && monthlyPkg && monthlyPkg.product.price > 0
    ? Math.round((1 - annualPkg.product.price / (monthlyPkg.product.price * 12)) * 100)
    : 58;

  const handleStartTrial = async () => {
    trackCustomEvent('paywall_cta_tap', { plan: selectedPlan, loading: offeringLoading ? 1 : 0 }).catch(() => {});
    // If still loading, wait — don't show error yet
    if (offeringLoading) return;

    const pkg =
      selectedPlan === 'annual' ? annualPkg :
      selectedPlan === 'monthly' ? monthlyPkg :
      lifetimePkg;

    if (!pkg) {
      // Retry once before failing
      setOfferingLoading(true);
      await loadOffering();
      setOfferingLoading(false);

      const retryPkg =
        selectedPlan === 'annual'
          ? useSubscriptionStore.getState().offering?.availablePackages.find(p => p.packageType === PACKAGE_TYPE.ANNUAL)
          : selectedPlan === 'monthly'
          ? useSubscriptionStore.getState().offering?.availablePackages.find(p => p.packageType === PACKAGE_TYPE.MONTHLY)
          : useSubscriptionStore.getState().offering?.availablePackages.find(p => p.packageType === PACKAGE_TYPE.LIFETIME);

      if (!retryPkg) {
        trackCustomEvent('paywall_plans_unavailable', { plan: selectedPlan }).catch(() => {});
        Alert.alert(
          'Plans Unavailable',
          'Could not load subscription plans right now. You can keep using Nibble for free and upgrade later from Settings.',
          [
            { text: 'Try again', style: 'cancel' },
            { text: 'Continue free', onPress: () => navigation.navigate('Main' as never) },
          ]
        );
        return;
      }

      const success = await purchase(retryPkg);
      if (success) navigation.navigate('Main' as never);
      return;
    }

    const success = await purchase(pkg);
    if (success) {
      navigation.navigate('Main' as never);
    }
  };

  const handleRestore = async () => {
    trackCustomEvent('paywall_restore_tap').catch(() => {});
    await restore();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={['rgba(0,230,118,0.08)', 'transparent']}
          style={styles.heroGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        <View style={styles.heroSection}>
          <View style={styles.blueprintReady}>
            <Ionicons name="checkmark-circle" size={18} color={C.accent} />
            <Text style={styles.blueprintReadyText}>Your Nutrition Blueprint is Ready</Text>
          </View>
          <Text style={styles.heroTitle}>Start your free trial{'\n'}to unlock it.</Text>

        </View>

        {/* Benefits */}
        <View style={styles.benefitsSection}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon as any} size={20} color={C.accent} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitMain}>{b.text}</Text>
                <Text style={styles.benefitSub}>{b.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing plans */}
        <Text style={styles.plansTitle}>Choose your plan</Text>

        {/* Annual — pre-selected, best value */}
        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
          onPress={() => setSelectedPlan('annual')}
          activeOpacity={0.8}
        >
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE · SAVE {annualSavePct}%</Text>
          </View>
          <View style={styles.planCardInner}>
            <View style={styles.planRadio}>
              <View style={[styles.radioInner, selectedPlan === 'annual' && styles.radioInnerSelected]} />
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, selectedPlan === 'annual' && { color: C.accent }]}>Annual</Text>
              <Text style={styles.planBilling}>Billed once a year</Text>
            </View>
            <View style={styles.planPrice}>
              <Text style={[styles.mainPrice, selectedPlan === 'annual' && { color: C.accent }]}>{annualFull}</Text>
              <Text style={styles.perPeriod}>/year</Text>
              <Text style={styles.equivPrice}>about {annualMonthly}/month</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Monthly — anchor price */}
        <TouchableOpacity
          style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelectedSecondary]}
          onPress={() => setSelectedPlan('monthly')}
          activeOpacity={0.8}
        >
          <View style={styles.planCardInner}>
            <View style={styles.planRadio}>
              <View style={[styles.radioInner, selectedPlan === 'monthly' && styles.radioInnerSecondary]} />
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>Monthly</Text>
              <Text style={styles.planBilling}>Billed every month</Text>
            </View>
            <View style={styles.planPrice}>
              <Text style={styles.mainPriceNeutral}>{monthlyPrice}</Text>
              <Text style={styles.perPeriod}>/month</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Lifetime — only when the store actually sells it */}
        {lifetimePkg && (
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'lifetime' && styles.planCardSelectedSecondary]}
            onPress={() => setSelectedPlan('lifetime')}
            activeOpacity={0.8}
          >
            <View style={styles.planCardInner}>
              <View style={styles.planRadio}>
                <View style={[styles.radioInner, selectedPlan === 'lifetime' && styles.radioInnerSecondary]} />
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>Lifetime</Text>
                <Text style={styles.planBilling}>One-time payment, forever</Text>
              </View>
              <View style={styles.planPrice}>
                <Text style={styles.mainPriceNeutral}>{lifetimePrice}</Text>
                <Text style={styles.perPeriod}>once</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (isPurchasing || offeringLoading) && { opacity: 0.7 }]}
          onPress={handleStartTrial}
          activeOpacity={0.85}
          disabled={isPurchasing || offeringLoading}
        >
          {isPurchasing || offeringLoading ? (
            <ActivityIndicator color="#0A0A0C" />
          ) : (
            <>
              <Text style={styles.ctaBtnText}>Start My Free Trial</Text>
              <Ionicons name="arrow-forward" size={18} color="#0A0A0C" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.ctaSubtext}>
          Try free for 7 days, then{' '}
          <Text style={styles.ctaSubtextPrice}>
            {selectedPlan === 'annual' ? `${annualFull}/year` : selectedPlan === 'monthly' ? `${monthlyPrice}/month` : `${lifetimePrice} once`}
          </Text>
        </Text>

        {/* Risk reversal */}
        <View style={styles.riskReversal}>
          {['Cancel anytime', 'No charge today', 'No commitment'].map((item, i) => (
            <View key={i} style={styles.riskItem}>
              <Ionicons name="checkmark" size={14} color={C.accent} />
              <Text style={styles.riskText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Transparent billing notice */}
        <View style={styles.billingNotice}>
          <Ionicons name="information-circle-outline" size={16} color={C.textTertiary} />
          <Text style={styles.billingNoticeText}>
            Your free trial ends {trialEndDate}. Cancel before then and pay nothing.{' '}
            {selectedPlan === 'lifetime'
              ? `Lifetime is a one-time charge of ${lifetimePrice} and does not renew.`
              : selectedPlan === 'annual'
              ? `After the trial you will be charged ${annualFull} per year. The subscription renews automatically every year at ${annualFull} unless cancelled at least 24 hours before the end of the current period.`
              : `After the trial you will be charged ${monthlyPrice} per month. The subscription renews automatically every month at ${monthlyPrice} unless cancelled at least 24 hours before the end of the current period.`}
          </Text>
        </View>

        {/* Continue free only when the store can't load plans, so the paywall is never a dead end */}
        {!offering && !offeringLoading && (
          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => {
              trackCustomEvent('paywall_continue_free', { plan: selectedPlan, had_offering: 0 }).catch(() => {});
              navigation.navigate('Main' as never);
            }}
            disabled={isPurchasing}
          >
            <Text style={styles.signInLinkText}>Continue with the free version</Text>
          </TouchableOpacity>
        )}

        {/* Already have account */}
        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => navigation.navigate('SignIn' as never)}
        >
          <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
        </TouchableOpacity>

        {/* Restore purchases */}
        <TouchableOpacity
          style={styles.signInLink}
          onPress={handleRestore}
          disabled={isPurchasing}
        >
          <Text style={[styles.signInLinkText, { color: C.textTertiary }]}>Restore purchases</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  blueprintReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.accentBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  blueprintReadyText: { fontSize: 13, fontWeight: '700', color: C.accent },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
    lineHeight: 42,
    marginBottom: 16,
  },
  benefitsSection: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 32,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  benefitText: { flex: 1 },
  benefitMain: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
  benefitSub: { fontSize: 13, color: C.textSub, lineHeight: 19 },
  plansTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  planCard: {
    marginHorizontal: 24,
    backgroundColor: C.surface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: C.accent,
    backgroundColor: 'rgba(0,230,118,0.06)',
  },
  planCardSelectedSecondary: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bestValueBadge: {
    backgroundColor: C.accent,
    paddingVertical: 6,
    alignItems: 'center',
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A0A0C',
    letterSpacing: 0.8,
  },
  planCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  radioInnerSelected: { backgroundColor: C.accent },
  radioInnerSecondary: { backgroundColor: C.textSub },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  planBilling: { fontSize: 13, color: C.textSub },
  planPrice: { alignItems: 'flex-end' },
  // Billed amount is always the dominant price element (App Review 3.1.2(c)).
  mainPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: C.text,
    lineHeight: 28,
  },
  mainPriceNeutral: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textSub,
  },
  perPeriod: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: '500',
    alignSelf: 'flex-end',
  },
  // Per-month equivalent: subordinate, small and muted.
  equivPrice: {
    fontSize: 11,
    color: C.textTertiary,
    fontWeight: '400',
    marginTop: 2,
  },
  ctaBtn: {
    marginHorizontal: 24,
    backgroundColor: C.accent,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  ctaBtnText: { color: '#0A0A0C', fontSize: 18, fontWeight: '800' },
  ctaSubtext: {
    textAlign: 'center',
    fontSize: 13,
    color: C.textSub,
    marginBottom: 20,
  },
  ctaSubtextPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  riskReversal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
    flexWrap: 'wrap',
    paddingHorizontal: 24,
  },
  riskItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  riskText: { fontSize: 12, color: C.textSub, fontWeight: '500' },
  billingNotice: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  billingNoticeText: {
    fontSize: 12,
    color: C.textTertiary,
    lineHeight: 18,
    flex: 1,
  },
  signInLink: { alignItems: 'center', paddingVertical: 8 },
  signInLinkText: { fontSize: 14, color: C.textSub, fontWeight: '500' },
});
