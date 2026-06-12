const fs = require('fs');
const path = 'C:/jpm_app/app/(tabs)/marketplace.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `  const { promotedProducts, regularProducts } = useMemo(() => {`;

const replacementStr = `  const cities = useMemo(() => {
    return Array.from(new Set(products.map(p => p.shopCity).filter(Boolean)))
  }, [products])

  const { promotedProducts, regularProducts } = useMemo(() => {`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Successfully restored cities.");
} else {
  console.log("Could not find target string in marketplace.");
}
