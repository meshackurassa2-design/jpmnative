import { getCdnUrl } from '../lib/cdn';
import { useTheme } from '../lib/theme';
import React from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PostType as Post } from './PostItem'

export function JobCard({ post, isAdmin, onDelete, onHideAll }: { post: Post, isAdmin?: boolean, onDelete?: () => void, onHideAll?: () => void }) {
  const s = post.settings || {}
  return (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        {post.profiles?.avatar_url ? (
          <Image source={{ uri: getCdnUrl(post.profiles.avatar_url) }} style={styles.jobAvatar} />
        ) : (
          <View style={[styles.jobAvatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{post.profiles?.full_name?.[0] || '?'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle}>{s.job_title || 'Job Opportunity'}</Text>
          <Text style={styles.jobCompany}>{s.company_name || post.profiles?.full_name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onHideAll && (
            <TouchableOpacity onPress={onHideAll} style={{ padding: 4, marginRight: isAdmin ? 4 : 0 }}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          )}
          {isAdmin && onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.jobDetails}>
        {s.job_type && (
          <View style={styles.jobBadge}>
            <Ionicons name="briefcase-outline" size={12} color="#475569" />
            <Text style={styles.jobBadgeText}>{s.job_type}</Text>
          </View>
        )}
        {s.location && (
          <View style={styles.jobBadge}>
            <Ionicons name="location-outline" size={12} color="#475569" />
            <Text style={styles.jobBadgeText}>{s.location}</Text>
          </View>
        )}
        {s.salary_range && (
          <View style={styles.jobBadge}>
            <Ionicons name="cash-outline" size={12} color="#475569" />
            <Text style={styles.jobBadgeText}>{s.salary_range}</Text>
          </View>
        )}
      </View>
      
      {post.content && (
        <Text style={styles.jobDesc} numberOfLines={3}>{post.content}</Text>
      )}
      
      <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85}>
        <Text style={styles.applyBtnText}>Apply Now</Text>
      </TouchableOpacity>
    </View>
  )
}

const getStyles = (colors: any) => StyleSheet.create({
  jobCard: {
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: colors.background, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.text, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  jobHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  jobAvatar: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.border },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.textDim },
  jobTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  jobCompany: { fontSize: 14, color: '#52525b', marginTop: 2, fontWeight: '500' },
  jobDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  jobBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  jobBadgeText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  jobDesc: { fontSize: 14, color: '#3f3f46', lineHeight: 20, marginBottom: 16 },
  applyBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  applyBtnText: { color: colors.background, fontSize: 15, fontWeight: '700' },
})
