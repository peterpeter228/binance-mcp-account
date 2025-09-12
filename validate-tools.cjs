#!/usr/bin/env node

// 简单的工具验证脚本
console.log('🚀 Binance MCP 工具验证报告');
console.log('=====================================');

// 检查工具文件是否存在
const fs = require('fs');
const path = require('path');

const toolFiles = [
  'src/tools/account.ts',
  'src/tools/spot.ts',
  'src/tools/futures.ts',
  'src/tools/market.ts',
  'src/tools/advanced.ts',
];

const utilFiles = ['src/utils/validation.ts', 'src/utils/formatter.ts', 'src/utils/logger.ts'];

console.log('\n📁 文件结构检查:');

let totalFiles = 0;
let existingFiles = 0;

[...toolFiles, ...utilFiles].forEach((file) => {
  totalFiles++;
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
    existingFiles++;
  } else {
    console.log(`  ❌ ${file} - 文件不存在`);
  }
});

console.log(`\n📊 文件完整性: ${existingFiles}/${totalFiles} (${Math.round((existingFiles / totalFiles) * 100)}%)`);

// 检查工具数量
console.log('\n🔧 工具数量统计:');

let totalTools = 0;
const expectedCounts = {
  'account.ts': 5,
  'spot.ts': 6,
  'futures.ts': 9,
  'market.ts': 9,
  'advanced.ts': 6,
};

toolFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');

    // 统计工具定义
    const toolMatches = content.match(/name:\s*['"`]binance_\w+['"`]/g) || [];
    const toolCount = toolMatches.length;
    const fileName = path.basename(file, '.ts');
    const expected = expectedCounts[fileName] || 0;

    totalTools += toolCount;

    const status = toolCount === expected ? '✅' : '⚠️';
    console.log(`  ${status} ${fileName}: ${toolCount}个工具 ${toolCount === expected ? '' : `(期望${expected}个)`}`);

    if (toolCount > 0) {
      const toolNames = toolMatches.map((match) => match.match(/['"`]([^'"`]+)['"`]/)[1]);
      toolNames.forEach((name) => {
        console.log(`     • ${name}`);
      });
    }
  }
});

console.log(`\n📈 总工具数: ${totalTools} (期望35个)`);

// 检查描述结构
console.log('\n📝 描述结构检查:');

const requiredSections = ['🔍 功能说明', '⚠️ 重要提醒', '🎯 适用场景', '输出示例'];

toolFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const fileName = path.basename(file, '.ts');

    let hasStructure = true;
    const missingSections = [];

    requiredSections.forEach((section) => {
      if (!content.includes(section) && !content.includes(section.substring(2))) {
        hasStructure = false;
        missingSections.push(section);
      }
    });

    if (hasStructure) {
      console.log(`  ✅ ${fileName}: 描述结构完整`);
    } else {
      console.log(`  ⚠️  ${fileName}: 缺少 ${missingSections.join(', ')}`);
    }
  }
});

// 检查新增的工具文件
console.log('\n🔧 工具增强检查:');

const enhancementFiles = [
  { file: 'src/utils/validation.ts', description: '参数验证工具' },
  { file: 'src/utils/formatter.ts', description: '结果格式化工具' },
];

enhancementFiles.forEach(({ file, description }) => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const hasExports = content.includes('export');
    const hasClasses = content.includes('class') || content.includes('function');

    if (hasExports && hasClasses) {
      console.log(`  ✅ ${description}: 已实现`);
    } else {
      console.log(`  ⚠️  ${description}: 实现不完整`);
    }
  } else {
    console.log(`  ❌ ${description}: 未找到`);
  }
});

console.log('\n✅ 验证完成！');

// 生成总结
console.log('\n📋 改进总结:');
console.log('=====================================');

const improvements = [
  '✅ 重新设计工具描述结构，使其更加规范化',
  '✅ 优化现货交易工具输出为书面友好格式',
  '✅ 优化合约交易工具输出为书面友好格式',
  '✅ 为市场数据工具添加书面友好的输出案例',
  '✅ 为账户管理工具添加书面友好的输出案例',
  '✅ 为高级分析工具添加书面友好的输出案例',
  '✅ 优化参数验证和缺省值提示逻辑',
  '✅ 改进工具执行后的结果回复格式',
  '🔄 测试和验证所有工具的描述准确性 (进行中)',
];

improvements.forEach((item) => console.log(item));

console.log('\n🎯 下一步建议:');
console.log('  1. 修复TypeScript编译错误');
console.log('  2. 运行完整的功能测试');
console.log('  3. 更新README和配置文档');
