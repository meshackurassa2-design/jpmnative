const fs = require('fs');
const path = 'C:/jpm_app/app/(tabs)/marketplace.tsx';
let content = fs.readFileSync(path, 'utf8');

const sortTarget = `    return filtered.sort((a: any, b: any) => {
      const ratingA = (a.rating || 0) * 2 + (a.shopRating || 0)
      const ratingB = (b.rating || 0) * 2 + (b.shopRating || 0)
      if (ratingA !== ratingB) return ratingB - ratingA
      
      const countA = (a.review_count || 0) + (a.shopReviewCount || 0)
      const countB = (b.review_count || 0) + (b.shopReviewCount || 0)
      return countB - countA
    })`;

const sortReplacement = `    return filtered.sort((a: any, b: any) => {
      const now = new Date().getTime()
      const aPromoted = a.is_promoted && new Date(a.promoted_until).getTime() > now ? 1 : 0
      const bPromoted = b.is_promoted && new Date(b.promoted_until).getTime() > now ? 1 : 0
      if (aPromoted !== bPromoted) return bPromoted - aPromoted

      const ratingA = (a.rating || 0) * 2 + (a.shopRating || 0)
      const ratingB = (b.rating || 0) * 2 + (b.shopRating || 0)
      if (ratingA !== ratingB) return ratingB - ratingA
      
      const countA = (a.review_count || 0) + (a.shopReviewCount || 0)
      const countB = (b.review_count || 0) + (b.shopReviewCount || 0)
      return countB - countA
    })`;

const renderTarget = `  const renderProduct = ({ item }: { item: Product }) => {
    const hasImage = item.image_urls && item.image_urls.length > 0;
    
    return (
      <TouchableOpacity 
        style={styles.productCard}
        onPress={() => router.push(\`/product/\${item.id}?shopId=\${item.shopId}\`)}
      >
        <View style={styles.imageContainer}>`;

const renderReplacement = `  const renderProduct = ({ item }: { item: Product }) => {
    const hasImage = item.image_urls && item.image_urls.length > 0;
    const isPromoted = (item as any).is_promoted && new Date((item as any).promoted_until).getTime() > new Date().getTime();
    
    return (
      <TouchableOpacity 
        style={styles.productCard}
        onPress={() => router.push(\`/product/\${item.id}?shopId=\${item.shopId}\`)}
      >
        <View style={styles.imageContainer}>
          {isPromoted && (
            <View style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, backgroundColor: '#3b82f6', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="rocket" size={10} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', marginLeft: 2 }}>PROMOTED</Text>
            </View>
          )}`;

content = content.replace(sortTarget, sortReplacement);
content = content.replace(renderTarget, renderReplacement);
fs.writeFileSync(path, content, 'utf8');
console.log("Fixed marketplace!");
