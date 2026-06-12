const fs = require('fs');
const path = 'C:/jpm_app/app/inventory/index.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `<TouchableOpacity
              style={[s.deleteBtn, { backgroundColor: '#3b82f6', borderColor: '#2563eb' }]}
              onPress={() => handlePromote(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="rocket" size={16} color="#fff" />
            </TouchableOpacity>`;

const replacementStr = `<TouchableOpacity
              style={[s.deleteBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
              onPress={() => handlePromote(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="megaphone-outline" size={16} color="#2563eb" />
            </TouchableOpacity>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Successfully patched promote button styles.");
} else {
  console.log("Could not find target string.");
}
