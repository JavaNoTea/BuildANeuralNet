# Neural Network Builder

A visual drag-and-drop neural network designer that generates clean PyTorch code. I built this to make deep learning more accessible and to bridge the gap between visual design and actual implementation.

![Neural Network Builder](https://img.shields.io/badge/React-18-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-Python-green) ![PyTorch](https://img.shields.io/badge/PyTorch-Ready-orange)

## Demo

Try it live at: **[buildaneural.net](https://www.buildaneural.net)**

<div align="center">
  <img src="screenshots/buildaneuralnetscreenshot1.png" alt="Neural Network Builder - Main Interface" width="80%">
  <br>
  <em>Main interface showing the visual drag-and-drop neural network designer</em>
</div>

## Why I Built This

As someone learning deep learning, I found it frustrating to translate neural network architectures from papers into actual code. I wanted a tool that would let me design networks visually and then generate the PyTorch implementation automatically.

## What It Does

- **Visual Design**: Drag and drop layers to build your network architecture
- **Real-time Validation**: See connection errors and type mismatches as you build
- **Code Generation**: Get clean, runnable PyTorch code from your visual design
- **Save & Load**: Keep your designs and iterate on them
- **User Accounts**: Sign up to save your models in the cloud

<div align="center">
  <img src="screenshots/buildaneuralnetscreenshot2.png" alt="Layer Configuration Panel" width="70%">
  <br>
  <em>Layer configuration panel with real-time parameter adjustment</em>
</div>

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- React Flow for the visual editor
- Tailwind CSS for styling
- Zustand for state management

**Backend:**
- FastAPI (Python)
- SQLAlchemy for database ORM
- JWT authentication
- SQLite/PostgreSQL

## Features I'm Proud Of

### Smart Connection Validation
The editor validates connections between layers in real-time, checking tensor dimensions and data types to prevent common mistakes.

<div align="center">
  <img src="screenshots/buildaneuralnetscreenshot5.png" alt="Connection Validation" width="70%">
  <br>
  <em>Real-time connection validation showing compatible layer connections</em>
</div>

### Additional Tool Information
Detailed layer information and parameter tooltips help users understand each component while building their networks.

<div align="center">
  <img src="screenshots/buildaneuralnetscreenshot3.png" alt="Additional Tool Information" width="70%">
  <br>
  <em>Comprehensive layer information and parameter guidance for users</em>
</div>

### Clean Code Generation
Instead of just dumping layers together, the generator creates properly structured PyTorch classes with:
- Proper imports and dependencies
- Clean forward() methods
- Training loops with optimizers
- Example usage code

<div align="center">
  <img src="screenshots/buildaneuralnetscreenshot4.png" alt="Generated PyTorch Code" width="75%">
  <br>
  <em>Clean, production-ready PyTorch code generated from the visual design</em>
</div>


## Quick Start

1. **Clone and install:**
```bash
git clone https://github.com/JavaNoTea/BuildANeuralNet.git
cd BuildANeuralNet
npm install
```

2. **Set up the backend:**
```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python migrate_database.py
```

3. **Start development servers:**
```bash
# Backend (from apps/api)
uvicorn main:app --reload

# Frontend (from apps/web) 
npm run dev
```

4. **Open http://localhost:3000**

## Environment Setup

Create `apps/api/.env`:
```bash
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here
DATABASE_URL=sqlite:///./nn_builder.db

# Optional: Email verification
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## How It Works

1. **Design**: Drag layers from the sidebar onto the canvas
2. **Connect**: Link layers by dragging from output to input ports
3. **Configure**: Click layers to set parameters (sizes, activations, etc.)
4. **Generate**: Hit the code button to get your PyTorch implementation
5. **Export**: Copy the code or save your design

## Example Output

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class NeuralNetwork(nn.Module):
    def __init__(self):
        super(NeuralNetwork, self).__init__()
        self.fc1 = nn.Linear(784, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, 10)

    def forward(self, x):
        x = x.view(x.size(0), -1)
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.fc3(x)
        return x

# Training setup
model = NeuralNetwork()
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
```

## Deployment

I deployed this on Railway for free hosting. The app uses Docker for easy deployment anywhere.

## Challenges I Solved

- **Type Safety**: Ensuring layer connections are valid at design time
- **State Management**: Keeping the visual editor and property panel in sync
- **Code Generation**: Translating visual graphs into clean, readable code
- **User Experience**: Making drag-and-drop feel natural and responsive

## What's Next

- Add more layer types (LSTM, Transformer blocks)
- Model visualization and architecture diagrams
- Integration with popular datasets
- Model performance predictions

## Contributing

Feel free to open issues or submit PRs! I'm always looking to improve this tool.

## License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

The GPL v3 license ensures that any derivative work must also be open source under the same license terms. 
