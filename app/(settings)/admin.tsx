import { getCdnUrl } from '../../lib/cdn';
// app/(settings)/admin.tsx
import { useTheme } from '../../lib/theme';
import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, ScrollView, TextInput, KeyboardAvoidingView, Platform, Linking
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import * as Clipboard from 'expo-clipboard'

export default function () {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth()
  const supabase = createClient()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'reports' | 'jobs' | 'verifications' | 'vouchers'>('reports')
  const [verifications, setVerifications] = useState<any[]>([])

  // Vouchers Form State
  const [voucherAmount, setVoucherAmount] = useState('500')
  const [voucherCount, setVoucherCount] = useState('10')
  const [generatingVouchers, setGeneratingVouchers] = useState(false)
  const [recentVouchers, setRecentVouchers] = useState<any[]>([])
  const [unusedVouchers, setUnusedVouchers] = useState<any[]>([])

  // Job Form State
  const [jobTitle, setJobTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [location, setLocation] = useState('')
  const [jobType, setJobType] = useState('Full-time')
  const [salary, setSalary] = useState('')
  const [applyUrl, setApplyUrl] = useState('')
  const [description, setDescription] = useState('')
  const [postingJob, setPostingJob] = useState(false)

  const fetchReports = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('content_reports')
      .select(`
        id, reason, created_at,
        posts (
          id, content, image_urls, created_at, is_archived,
          profiles ( id, username, full_name, avatar_url )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (data) {
      const grouped = data.reduce((acc: any, report: any) => {
        const post = report.posts
        if (!post) return acc
        const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles

        if (!acc[post.id]) {
          acc[post.id] = { post: { ...post, profiles: profile }, reports: [], count: 0 }
        }
        acc[post.id].reports.push(report)
        acc[post.id].count += 1
        return acc
      }, {})

      setReports(Object.values(grouped).sort((a: any, b: any) => b.count - a.count))
    }
    
    // Fetch pending verifications
    const { data: vData } = await supabase
      .from('verification_requests')
      .select('id, user_id, reason, full_name, known_as, category, document_url, created_at, profiles(username, full_name, avatar_url, is_verified)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (vData) setVerifications(vData)

    fetchUnusedVouchers()
      
    setLoading(false)
  }

  const fetchUnusedVouchers = async () => {
    const { data } = await supabase
      .from('vouchers')
      .select('code, amount_tsh, created_at')
      .eq('is_redeemed', false)
      .order('created_at', { ascending: false })
    if (data) setUnusedVouchers(data)
  }

  useEffect(() => { fetchReports() }, [])

  const dismissReports = async (postId: string) => {
    await supabase.from('content_reports').update({ status: 'dismissed' }).eq('post_id', postId).eq('status', 'pending')
    await supabase.from('posts').update({ is_archived: false }).eq('id', postId)
    setReports(prev => prev.filter(r => r.post.id !== postId))
  }

  const deletePost = async (postId: string) => {
    Alert.alert(
      'Delete Post',
      'This will permanently delete the post and all its reports. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            const { error } = await supabase.from('posts').delete().eq('id', postId)
            if (error) {
              Alert.alert('Delete Failed', error.message)
            } else {
              setReports(prev => prev.filter(r => r.post.id !== postId))
              Alert.alert('Success', 'Post completely deleted.')
            }
          }
        }
      ]
    )
  }

  const handleGenerateVouchers = async () => {
    const val = parseInt(voucherAmount)
    const cnt = parseInt(voucherCount)
    if (isNaN(val) || isNaN(cnt) || val <= 0 || cnt <= 0) {
      Alert.alert('Invalid Input', 'Please enter valid numbers.')
      return
    }

    setGeneratingVouchers(true)
    
    try {
      const { data, error } = await supabase.rpc('generate_vouchers', {
        p_value: val,
        p_count: cnt
      })
      
      if (error) throw error
      
      Alert.alert('Success', `Generated ${data.length} vouchers!`)
      setRecentVouchers(data)
      fetchUnusedVouchers()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setGeneratingVouchers(false)
    }
  }

  const handlePostJob = async () => {
    if (!user) return
    if (!jobTitle || !companyName || !location || !applyUrl || !description) {
      Alert.alert('Error', 'Please fill in all required fields.')
      return
    }

    setPostingJob(true)
    const content = `💼 **New Job Opportunity: ${jobTitle} at ${companyName}**\n\n${description}\n\n📍 ${location} | Salary: ${salary || 'Unspecified'} | ⏱️ ${jobType}`

    const { error } = await supabase.from('posts').insert({
      creator_id: user.id,
      content,
      settings: {
        is_job: true,
        job_title: jobTitle,
        company_name: companyName,
        location,
        job_type: jobType,
        salary_range: salary,
        apply_url: applyUrl
      }
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Success', 'Job posted successfully!')
      setJobTitle(''); setCompanyName(''); setLocation('')
      setSalary(''); setApplyUrl(''); setDescription('')
    }
    setPostingJob(false)
  }

  const handleVerifyRequest = async (requestId: string, userId: string, approve: boolean) => {
    Alert.alert(
      approve ? 'Approve Verification' : 'Reject Request',
      `Are you sure you want to ${approve ? 'approve' : 'reject'} this request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            await supabase.from('verification_requests').update({ status: approve ? 'approved' : 'rejected' }).eq('id', requestId)
            if (approve) {
              await supabase.from('profiles').update({ is_verified: true }).eq('id', userId)
            }
            setVerifications(prev => prev.filter(v => v.id !== requestId))
          }
        }
      ]
    )
  }

  const renderItem = ({ item }: { item: any }) => {
    const post = item.post
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          {post.is_archived && (
            <View style={styles.archivedBadge}>
              <Text style={styles.archivedText}>Auto-Archived</Text>
            </View>
          )}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.count} Report{item.count !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={styles.postPreview}>
          <Text style={styles.posterName}>{post.profiles?.full_name || 'Unknown'}</Text>
          <Text style={styles.posterUsername}>@{post.profiles?.username || 'user'}</Text>
          {!!post.content && <Text style={styles.postContent} numberOfLines={4}>{post.content}</Text>}
          {post.image_urls && post.image_urls.length > 0 && (
            <Image source={{ uri: getCdnUrl(post.image_urls[0]) }} style={styles.postImage} />
          )}
        </View>

        <View style={styles.reportReasons}>
          {item.reports.slice(0, 3).map((r: any, i: number) => (
            <View key={i} style={styles.reasonChip}>
              <Text style={styles.reasonText}>"{r.reason}"</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => deletePost(post.id)}>
            <Ionicons name="trash-outline" size={16} color="#dc2626" />
            <Text style={styles.btnDeleteText}>Delete Post</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDismiss]} onPress={() => dismissReports(post.id)}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
            <Text style={styles.btnDismissText}>Dismiss (Safe)</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'reports' && styles.tabActive]} onPress={() => setActiveTab('reports')}>
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'verifications' && styles.tabActive]} onPress={() => setActiveTab('verifications')}>
          <Text style={[styles.tabText, activeTab === 'verifications' && styles.tabTextActive]}>Verifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'jobs' && styles.tabActive]} onPress={() => setActiveTab('jobs')}>
          <Text style={[styles.tabText, activeTab === 'jobs' && styles.tabTextActive]}>Post Job</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'vouchers' && styles.tabActive]} onPress={() => setActiveTab('vouchers')}>
          <Text style={[styles.tabText, activeTab === 'vouchers' && styles.tabTextActive]}>Vouchers</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'reports' ? (
        <FlatList
          data={reports}
          keyExtractor={item => item.post.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark" size={48} color="#d4d4d8" />
              <Text style={styles.emptyTitle}>No Pending Reports</Text>
              <Text style={styles.emptyDesc}>Your community is behaving nicely!</Text>
            </View>
          }
        />
      ) : activeTab === 'verifications' ? (
        <FlatList
          data={verifications}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle" size={48} color="#d4d4d8" />
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptyDesc}>All verification requests have been handled.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const profile = item.profiles || {}
            return (
              <View style={styles.card}>
                <View style={[styles.postPreview, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  {profile.avatar_url ? (
                    <Image source={{ uri: getCdnUrl(profile.avatar_url) }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#d4d4d8', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700' }}>{profile.full_name?.[0] || '?'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.posterName}>{profile.full_name}</Text>
                    <Text style={styles.posterUsername}>@{profile.username}</Text>
                  </View>
                </View>
                {item.full_name && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>Legal Name: <Text style={{ fontWeight: '400' }}>{item.full_name}</Text></Text>
                    <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>Known As: <Text style={{ fontWeight: '400' }}>{item.known_as}</Text></Text>
                    <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>Category: <Text style={{ fontWeight: '400' }}>{item.category}</Text></Text>
                    <Text style={{ color: colors.text, fontWeight: '700', marginTop: 8 }}>Reason:</Text>
                    <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 4 }}>{item.reason}</Text>
                    
                    {item.document_url && (
                      <TouchableOpacity 
                        style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#3b82f6', borderRadius: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => Linking.openURL(item.document_url)}
                      >
                        <Ionicons name="document-attach" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#fff', fontWeight: '600' }}>View ID Document</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {!item.full_name && (
                  <View style={styles.reasonChip}>
                    <Text style={[styles.reasonText, { color: '#3f3f46' }]}>Reason: {item.reason}</Text>
                  </View>
                )}
                <View style={[styles.actions, { marginTop: 12 }]}>
                  <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={() => handleVerifyRequest(item.id, item.user_id, false)}>
                    <Ionicons name="close" size={16} color="#dc2626" />
                    <Text style={styles.btnDeleteText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { borderColor: '#2563eb', backgroundColor: '#eff6ff' }]} onPress={() => handleVerifyRequest(item.id, item.user_id, true)}>
                    <Ionicons name="checkmark" size={16} color="#2563eb" />
                    <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 13 }}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
        />
      ) : activeTab === 'vouchers' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Generate Vouchers</Text>
              
              <Text style={styles.label}>TSH Value (Amount)</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 5000" value={voucherAmount} onChangeText={setVoucherAmount} />

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
                  <TouchableOpacity 
                    key={i} 
                    style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.border, padding: 12, borderRadius: 8, marginBottom: 8 }}
                    onPress={async () => {
                      await Clipboard.setStringAsync(v.code)
                      Alert.alert('Copied!', `${v.code} copied to clipboard!`)
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontWeight: '700', color: colors.text, letterSpacing: 1 }}>{v.code}</Text>
                    <Text style={{ color: '#10b981', fontWeight: '800' }}>{v.amount_tsh} TSH</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {unusedVouchers.length > 0 && (
              <View style={[styles.formCard, { marginTop: 16 }]}>
                <Text style={styles.formTitle}>Vault ({unusedVouchers.length} unused)</Text>
                <Text style={{ color: colors.textDim, marginBottom: 12, fontSize: 13 }}>All generated vouchers that haven't been claimed yet.</Text>
                
                {unusedVouchers.map((v, i) => (
                  <TouchableOpacity 
                    key={v.code} 
                    style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.background, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}
                    onPress={async () => {
                      await Clipboard.setStringAsync(v.code)
                      Alert.alert('Copied!', `${v.code} copied to clipboard!`)
                    }}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={{ fontWeight: '700', color: colors.text, letterSpacing: 1 }}>{v.code}</Text>
                      <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>Created: {new Date(v.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={{ color: '#10b981', fontWeight: '800' }}>{v.amount_tsh} TSH</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Post a New Job</Text>

              <Text style={styles.label}>Job Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Senior Frontend Engineer" value={jobTitle} onChangeText={setJobTitle} />

              <Text style={styles.label}>Company Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Acme Corp" value={companyName} onChangeText={setCompanyName} />

              <Text style={styles.label}>Location *</Text>
              <TextInput style={styles.input} placeholder="e.g. Remote, or New York" value={location} onChangeText={setLocation} />

              <Text style={styles.label}>Job Type</Text>
              <TextInput style={styles.input} placeholder="Full-time, Part-time, Contract..." value={jobType} onChangeText={setJobType} />

              <Text style={styles.label}>Salary Range</Text>
              <TextInput style={styles.input} placeholder="e.g. $100k - $120k" value={salary} onChangeText={setSalary} />

              <Text style={styles.label}>Application URL *</Text>
              <TextInput style={styles.input} placeholder="https://..." value={applyUrl} onChangeText={setApplyUrl} keyboardType="url" autoCapitalize="none" />

              <Text style={styles.label}>Job Description *</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Describe the role, requirements..." value={description} onChangeText={setDescription} multiline textAlignVertical="top" />

              <TouchableOpacity style={styles.submitBtn} onPress={handlePostJob} disabled={postingJob}>
                {postingJob ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Post Job</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.border },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.border },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.text },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  tabTextActive: { color: colors.text },
  list: { padding: 16, gap: 16 },
  card: { backgroundColor: colors.background, borderRadius: 16, padding: 16, elevation: 2, shadowColor: colors.text, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { height: 2, width: 0 } },
  cardTop: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  badge: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  archivedBadge: { backgroundColor: '#fef9c3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  archivedText: { color: '#a16207', fontSize: 12, fontWeight: '700' },
  postPreview: { backgroundColor: '#fafafa', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  posterName: { fontSize: 14, fontWeight: '700', color: colors.text },
  posterUsername: { fontSize: 12, color: colors.textDim, marginBottom: 8 },
  postContent: { fontSize: 14, color: '#3f3f46', lineHeight: 20, marginBottom: 8 },
  postImage: { width: '100%', height: 140, borderRadius: 8 },
  reportReasons: { gap: 6, marginBottom: 14 },
  reasonChip: { backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  reasonText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  btnDismiss: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  btnDismissText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  btnDelete: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  btnDeleteText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textDim, textAlign: 'center' },
  formContainer: { padding: 16 },
  formCard: { backgroundColor: colors.background, borderRadius: 16, padding: 20 },
  formTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#3f3f46', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1, borderColor: colors.border, color: colors.text },
  textArea: { height: 120 },
  submitBtn: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
})
