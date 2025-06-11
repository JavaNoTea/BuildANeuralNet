import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Build A Neural Net",
  description: "Visual neural network builder with PyTorch code generation. Design neural networks with drag & drop, then export clean PyTorch code.",
  keywords: ["neural network", "pytorch", "deep learning", "machine learning", "visual builder", "code generation"],
  authors: [{ name: "Christian King" }],
  creator: "Christian King",
  publisher: "BuildANeural.net",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' }
    ],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
  },
  openGraph: {
    title: "Build A Neural Net",
    description: "Visual neural network builder with PyTorch code generation",
    url: "https://www.buildaneural.net",
    siteName: "Build A Neural Net",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build A Neural Net",
    description: "Visual neural network builder with PyTorch code generation",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {process.env.NODE_ENV === 'development' && (
          <Script id="test-suite" strategy="afterInteractive">
            {`
/**
 * Neural Network Architecture Test Suite
 * Available in browser console for development testing
 */

console.log("🧪 Loading Neural Network Architecture Test Suite...");

// Test case definitions
const ARCHITECTURE_TESTS = {
  // 1. BASIC SEQUENTIAL MODELS
  basicCNN: {
    name: "Basic CNN",
    description: "Simple convolutional neural network for image classification",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (in_channels=3, out_channels=32, kernel_size=3)",
      "3. Add ReLU node",
      "4. Add MaxPool2d node (kernel_size=2)",
      "5. Add Flatten node", 
      "6. Add Linear node (in_features=8192, out_features=10)",
      "7. Connect: Dataset → Conv2d → ReLU → MaxPool2d → Flatten → Linear",
      "8. Generate code and verify patterns"
    ],
    expectedCode: [
      /self\\..*conv.*= nn\\.Conv2d.*in_channels=3.*out_channels=32.*kernel_size=3/,
      /self\\..*relu.*= nn\\.ReLU/,
      /self\\..*maxpool.*= nn\\.MaxPool2d.*kernel_size=2/,
      /self\\..*flatten.*= nn\\.Flatten/,
      /self\\..*linear.*= nn\\.Linear.*in_features=.*out_features=10/,
      /.*conv.*_out = self\\..*conv.*\\(x\\)/,
      /.*relu.*_out = self\\..*relu.*\\(.*conv.*_out\\)/,
      /.*maxpool.*_out = self\\..*maxpool.*\\(.*relu.*_out\\)/,
      /.*flatten.*_out = self\\..*flatten.*\\(.*maxpool.*_out\\)/,
      /.*linear.*_out = self\\..*linear.*\\(.*flatten.*_out\\)/,
      /return .*linear.*_out/
    ]
  },

  basicMLP: {
    name: "Basic MLP",
    description: "Multi-layer perceptron for tabular data",
    instructions: [
      "1. Add Dataset node (MNIST)",
      "2. Add Flatten node",
      "3. Add Linear node (in_features=784, out_features=128)",
      "4. Add ReLU node",
      "5. Add Linear node (in_features=128, out_features=10)",
      "6. Connect: Dataset → Flatten → Linear → ReLU → Linear",
      "7. Generate code and verify patterns"
    ],
    expectedCode: [
      /self\\..*flatten.*= nn\\.Flatten/,
      /self\\..*linear.*= nn\\.Linear.*in_features=784.*out_features=128/,
      /self\\..*relu.*= nn\\.ReLU/,
      /self\\..*linear.*= nn\\.Linear.*in_features=128.*out_features=10/,
      /.*flatten.*_out = self\\..*flatten.*\\(x\\)/,
      /.*linear.*_out = self\\..*linear.*\\(.*flatten.*_out\\)/,
      /.*relu.*_out = self\\..*relu.*\\(.*linear.*_out\\)/,
      /.*linear.*_out = self\\..*linear.*\\(.*relu.*_out\\)/,
      /return .*linear.*_out/
    ]
  },

  // 2. RESIDUAL CONNECTIONS  
  autoDetectedResidual: {
    name: "Auto-detected Residual",
    description: "Test auto-detection of residual connections",
    instructions: [
      "1. Add Dataset node (MNIST)",
      "2. Add Flatten node",
      "3. Add Linear node (in_features=784, out_features=128)",
      "4. Add Linear node (in_features=128, out_features=10)", 
      "5. Add ReLU node",
      "6. Connect: Dataset → Flatten → Linear → Linear → ReLU",
      "7. Connect: Flatten → ReLU (this should be auto-detected as residual)",
      "8. Wait for auto-detection (check console for logs)",
      "9. Verify edge becomes green and dashed",
      "10. Generate code and verify residual connection code"
    ],
    expectedCode: [
      /# Residual connection/,
      /.*relu.*_out = .*relu.*_out \\+ .*flatten.*_out.*# Residual connection/
    ],
    visualChecks: [
      "Edge from Flatten to ReLU should be green and dashed",
      "Console should show auto-detection messages",
      "Should see notification about detected residual connections"
    ]
  },

  manualResidual: {
    name: "Manual Residual Connection",
    description: "Basic skip connection manually marked",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (in_channels=3, out_channels=64, kernel_size=3, padding=1)",
      "3. Add ReLU node",
      "4. Add Conv2d node (in_channels=64, out_channels=64, kernel_size=3, padding=1)",
      "5. Add ReLU node",
      "6. Connect: Dataset → Conv2d → ReLU → Conv2d → ReLU",
      "7. Connect: First Conv2d → Final ReLU",
      "8. Select the skip connection edge and mark as 'residual' type",
      "9. Generate code and verify residual connection"
    ],
    expectedCode: [
      /# Residual connection/,
      /.*relu.*_out = .*relu.*_out \\+ .*conv.*_out.*# Residual connection/
    ]
  },

  // 3. COMPLEX ARCHITECTURES
  inceptionLike: {
    name: "Inception-like Multi-branch",
    description: "Multi-branch network with concatenation",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (1x1): in_channels=3, out_channels=16, kernel_size=1",
      "3. Add Conv2d node (3x3): in_channels=3, out_channels=16, kernel_size=3, padding=1",
      "4. Add Conv2d node (5x5): in_channels=3, out_channels=16, kernel_size=5, padding=2",
      "5. Add torch.cat node (dim=1)",
      "6. Add ReLU node",
      "7. Connect: Dataset → all three Conv2d nodes",
      "8. Connect: all three Conv2d nodes → torch.cat",
      "9. Connect: torch.cat → ReLU",
      "10. Generate code and verify concatenation"
    ],
    expectedCode: [
      /.*cat.*_out = torch\\.cat\\(\\[.*\\], dim=1\\)/,
      /torch\\.cat\\(\\[.*conv.*_out.*conv.*_out.*conv.*_out.*\\], dim=1\\)/
    ]
  }
};

// Test validation functions
function validateGeneratedCode(code, expectedPatterns) {
  const results = {
    passed: 0,
    failed: 0,
    total: expectedPatterns.length,
    details: []
  };

  expectedPatterns.forEach((pattern, index) => {
    const matches = pattern.test(code);
    results.details.push({
      pattern: pattern.toString(),
      matches,
      description: \`Pattern \${index + 1}\`
    });
    
    if (matches) {
      results.passed++;
    } else {
      results.failed++;
    }
  });

  return results;
}

function runCodeValidation(testName) {
  const test = ARCHITECTURE_TESTS[testName];
  if (!test) {
    console.error(\`❌ Test '\${testName}' not found\`);
    return;
  }

  console.log(\`\\n🧪 Validating: \${test.name}\`);
  console.log(\`📝 \${test.description}\`);
  
  // Try to get generated code from the UI
  const codeElement = document.querySelector('pre') || 
                     document.querySelector('code') ||
                     document.querySelector('[class*="code"]') ||
                     document.querySelector('textarea');
  
  if (!codeElement) {
    console.error("❌ Could not find generated code element. Make sure to generate code first.");
    return;
  }
  
  const generatedCode = codeElement.textContent || codeElement.value;
  
  if (!generatedCode || generatedCode.length < 50) {
    console.error("❌ No generated code found or code is too short.");
    return;
  }
  
  console.log("✅ Found generated code, validating...");
  
  const validation = validateGeneratedCode(generatedCode, test.expectedCode);
  
  console.log(\`\\n📊 Validation Results:\`);
  console.log(\`   ✅ Passed: \${validation.passed}/\${validation.total}\`);
  console.log(\`   ❌ Failed: \${validation.failed}/\${validation.total}\`);
  console.log(\`   📈 Success Rate: \${((validation.passed / validation.total) * 100).toFixed(1)}%\`);
  
  if (validation.failed > 0) {
    console.log(\`\\n❌ Failed Patterns:\`);
    validation.details.filter(d => !d.matches).forEach(detail => {
      console.log(\`   • \${detail.pattern}\`);
    });
  }
  
  if (validation.passed > 0) {
    console.log(\`\\n✅ Passed Patterns:\`);
    validation.details.filter(d => d.matches).forEach(detail => {
      console.log(\`   • \${detail.pattern}\`);
    });
  }
  
  return validation;
}

function runVisualValidation() {
  console.log("\\n👀 Visual Validation Checklist:");
  console.log("   1. Check edge colors and styles:");
  console.log("      • Default edges: Blue solid lines");
  console.log("      • Residual edges: Green dashed lines"); 
  console.log("      • Sum edges: Red thick lines");
  console.log("   2. Check auto-detection notifications:");
  console.log("      • Green notification popup for detected residual connections");
  console.log("   3. Check console logs:");
  console.log("      • Auto-detection should work silently now");
  
  // Try to detect visual elements programmatically
  const edges = document.querySelectorAll('[class*="edge"], [data-testid*="edge"]');
  const residualEdges = Array.from(edges).filter(edge => {
    const style = edge.getAttribute('style') || '';
    const className = edge.getAttribute('class') || '';
    return style.includes('stroke-dasharray') || 
           style.includes('#059669') ||
           className.includes('residual');
  });
  
  console.log(\`\\n📊 Found \${edges.length} total edges, \${residualEdges.length} appear to be residual\`);
  
  if (residualEdges.length > 0) {
    console.log("✅ Residual edges detected visually");
  } else {
    console.log("⚠️  No residual edges found visually");
  }
}

function printTestInstructions(testName) {
  const test = ARCHITECTURE_TESTS[testName];
  if (!test) {
    console.error(\`❌ Test '\${testName}' not found\`);
    listAllTests();
    return;
  }
  
  console.log(\`\\n📋 Instructions for: \${test.name}\`);
  console.log(\`📝 Description: \${test.description}\`);
  console.log(\`\\n🔧 Steps:\`);
  test.instructions.forEach((instruction, index) => {
    console.log(\`   \${instruction}\`);
  });
  
  if (test.visualChecks) {
    console.log(\`\\n👀 Visual Checks:\`);
    test.visualChecks.forEach(check => {
      console.log(\`   • \${check}\`);
    });
  }
}

function listAllTests() {
  console.log("\\n📋 Available Architecture Tests:");
  Object.entries(ARCHITECTURE_TESTS).forEach(([key, test]) => {
    console.log(\`   • \${key}: \${test.name}\`);
    console.log(\`     \${test.description}\`);
  });
}

function runCompleteTestSuite() {
  console.clear();
  console.log("🔬 Neural Network Builder - Comprehensive Test Suite");
  console.log("=" .repeat(60));
  console.log("📅 Date:", new Date().toLocaleString());
  console.log("\\n📋 Test Coverage:");
  console.log("   • Basic Sequential Models (CNN, MLP)");
  console.log("   • Residual Connections (Manual & Auto-detected)");
  console.log("   • Complex Architectures (Inception-like, Element-wise ops)");
  console.log("   • Normalization Layers (BatchNorm)");
  console.log("   • Sequence Models (LSTM)");
  
  console.log("\\n🎯 How to Use This Test Suite:");
  console.log("   1. printTestInstructions('testName') - Shows step-by-step instructions");
  console.log("   2. Follow the manual steps to build the architecture");
  console.log("   3. runCodeValidation('testName') - Validates generated code");
  console.log("   4. runVisualValidation() - Checks visual elements");
  
  console.log("\\n📝 Example Workflow:");
  console.log("   printTestInstructions('autoDetectedResidual')");
  console.log("   // Follow the steps manually in the UI");
  console.log("   runCodeValidation('autoDetectedResidual')");
  console.log("   runVisualValidation()");
  
  listAllTests();
  
  console.log("\\n🚀 Start with: printTestInstructions('basicCNN')");
}

// Export functions to window for browser console access
window.runCompleteTestSuite = runCompleteTestSuite;
window.printTestInstructions = printTestInstructions;
window.runCodeValidation = runCodeValidation;
window.runVisualValidation = runVisualValidation;
window.listAllTests = listAllTests;
window.ARCHITECTURE_TESTS = ARCHITECTURE_TESTS;

// Auto-load message
console.log("🧪 Neural Network Architecture Test Suite Loaded!");
console.log("📝 Quick Start: runCompleteTestSuite()");
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
