const fs = require('fs');

const fixWallet = () => {
  const path = 'C:/jpm_app/app/wallet.tsx';
  let content = fs.readFileSync(path, 'utf8');

  // 1. Add state for voucher code
  const stateTarget = `  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])`;
  const stateReplace = `  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [voucherCode, setVoucherCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)`;
  content = content.replace(stateTarget, stateReplace);

  // 2. Add handleRedeem function
  const functionTarget = `  const handlePurchase = async (pkg: any) => {`;
  const functionReplace = `  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) {
      Alert.alert('Empty Code', 'Please enter a voucher code.');
      return;
    }
    
    setRedeeming(true);
    const { data, error } = await supabase.rpc('redeem_voucher', {
      p_user_id: user?.id,
      p_code: voucherCode.trim().toUpperCase()
    });
    setRedeeming(false);
    
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Redemption Failed', error.message || 'Invalid or already used voucher.');
    } else if (data) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success! 🎉', \`You have successfully redeemed \${data} coins!\`);
      setVoucherCode('');
      fetchWallet();
    }
  }

  const handlePurchase = async (pkg: any) => {`;
  content = content.replace(functionTarget, functionReplace);

  // 3. Add UI below Balance Card
  const uiTarget = `        {/* Quick Actions Grid */}`;
  const uiReplace = `        {/* Redeem Voucher Section */}
        <View style={styles.voucherSection}>
          <Text style={styles.formLabel}>Redeem a Voucher</Text>
          <View style={styles.voucherRow}>
            <TextInput
              style={styles.voucherInput}
              placeholder="e.g. 500-COIN-XYZ"
              placeholderTextColor="#a1a1aa"
              value={voucherCode}
              onChangeText={setVoucherCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity 
              style={[styles.redeemBtn, redeeming && { opacity: 0.7 }]} 
              onPress={handleRedeemVoucher}
              disabled={redeeming}
            >
              {redeeming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.redeemBtnText}>Redeem</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Grid */}`;
  content = content.replace(uiTarget, uiReplace);

  // 4. Add Styles
  const styleTarget = `  formLabel: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },`;
  const styleReplace = `  formLabel: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  voucherSection: { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
  voucherRow: { flexDirection: 'row', gap: 12 },
  voucherInput: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, color: colors.text, fontSize: 16, height: 48 },
  redeemBtn: { backgroundColor: '#3b82f6', borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, height: 48 },
  redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },`;
  content = content.replace(styleTarget, styleReplace);

  fs.writeFileSync(path, content, 'utf8');
  console.log("Wallet updated.");
};

fixWallet();
