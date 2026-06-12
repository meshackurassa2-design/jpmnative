const fs = require('fs');

const path = 'C:/jpm_app/app/(settings)/admin.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add vouchers to activeTab state
const stateTarget = `const [activeTab, setActiveTab] = useState<'reports' | 'jobs' | 'verifications'>('reports')`;
const stateReplace = `const [activeTab, setActiveTab] = useState<'reports' | 'jobs' | 'verifications' | 'vouchers'>('reports')
  const [voucherAmount, setVoucherAmount] = useState('500')
  const [voucherCount, setVoucherCount] = useState('10')
  const [generatingVouchers, setGeneratingVouchers] = useState(false)
  const [recentVouchers, setRecentVouchers] = useState<any[]>([])`;
content = content.replace(stateTarget, stateReplace);

// 2. Add generate handler
const funcTarget = `  const handlePostJob = async () => {`;
const funcReplace = `  const handleGenerateVouchers = async () => {
    const val = parseInt(voucherAmount)
    const cnt = parseInt(voucherCount)
    if (isNaN(val) || isNaN(cnt) || val <= 0 || cnt <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid numbers.')
      return
    }

    setGeneratingVouchers(true)
    const { data, error } = await supabase.rpc('generate_vouchers', {
      p_value: val,
      p_count: cnt
    })
    setGeneratingVouchers(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else if (data) {
      Alert.alert('Success', \`Generated \${data.length} vouchers!\`)
      setRecentVouchers(data) // data is array of {generated_code, value}
    }
  }

  const handlePostJob = async () => {`;
content = content.replace(funcTarget, funcReplace);

// 3. Add Tab Button
const tabTarget = `        <TouchableOpacity style={[styles.tab, activeTab === 'jobs' && styles.tabActive]} onPress={() => setActiveTab('jobs')}>
          <Text style={[styles.tabText, activeTab === 'jobs' && styles.tabTextActive]}>Post Job</Text>
        </TouchableOpacity>`;
const tabReplace = `        <TouchableOpacity style={[styles.tab, activeTab === 'jobs' && styles.tabActive]} onPress={() => setActiveTab('jobs')}>
          <Text style={[styles.tabText, activeTab === 'jobs' && styles.tabTextActive]}>Post Job</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'vouchers' && styles.tabActive]} onPress={() => setActiveTab('vouchers')}>
          <Text style={[styles.tabText, activeTab === 'vouchers' && styles.tabTextActive]}>Vouchers</Text>
        </TouchableOpacity>`;
content = content.replace(tabTarget, tabReplace);

// 4. Add Vouchers View
const viewTarget = `      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>`;
const viewReplace = `      ) : activeTab === 'vouchers' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Generate Vouchers</Text>
              
              <Text style={styles.label}>Coin Value</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {['500', '2500', '10000'].map(val => (
                  <TouchableOpacity 
                    key={val} 
                    style={[styles.btn, voucherAmount === val ? { borderColor: '#2563eb', backgroundColor: '#eff6ff' } : { backgroundColor: colors.border, borderColor: 'transparent' }]}
                    onPress={() => setVoucherAmount(val)}
                  >
                    <Text style={{ fontWeight: '700', color: voucherAmount === val ? '#2563eb' : colors.textDim }}>{val} 🪙</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Quantity to Generate</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={voucherCount} onChangeText={setVoucherCount} />

              <TouchableOpacity style={styles.submitBtn} onPress={handleGenerateVouchers} disabled={generatingVouchers}>
                {generatingVouchers ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Generate {voucherCount} Vouchers</Text>}
              </TouchableOpacity>
            </View>

            {recentVouchers.length > 0 && (
              <View style={[styles.formCard, { marginTop: 16 }]}>
                <Text style={styles.formTitle}>Recently Generated</Text>
                <Text style={{ color: colors.textDim, marginBottom: 12, fontSize: 13 }}>These codes are now live in the database.</Text>
                
                {recentVouchers.map((v, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.border, padding: 12, borderRadius: 8, marginBottom: 8 }}>
                    <Text style={{ fontWeight: '700', color: colors.text, letterSpacing: 1 }}>{v.generated_code}</Text>
                    <Text style={{ color: '#10b981', fontWeight: '800' }}>{v.value} 🪙</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>`;
content = content.replace(viewTarget, viewReplace);

fs.writeFileSync(path, content, 'utf8');
console.log("Admin screen updated with vouchers tab.");
