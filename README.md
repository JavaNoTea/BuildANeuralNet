# Neural Network Builder

A visual, web-based neural network builder that lets you create, customize, and export neural network architectures through an intuitive drag-and-drop interface. Build your neural networks visually and get clean PyTorch code ready for training!

## 🚀 Features

### 🎨 Visual Network Designer
- **Drag-and-Drop Interface**: Build neural networks with intuitive visual tools
- **Real-time Visualization**: See your network architecture as you build
- **Node Types**: Dense layers, Conv2D, MaxPool2D, Dropout, and more
- **Customizable Parameters**: Configure activation functions, layer sizes, and hyperparameters

### 💻 Code Generation
- **PyTorch Export**: Generate clean, runnable PyTorch code from your visual designs
- **Complete Training Scripts**: Get full training loops with data loading and optimization
- **Industry Standard**: Generated code follows PyTorch best practices

### 💾 Project Management
- **Save & Load**: Persist your network designs and reload them later
- **Model Persistence**: Save models to your account with user authentication
- **Export Options**: Download your projects as JSON files

## Tech Stack

- **Frontend**: React 18, TypeScript, React Flow, Tailwind CSS
- **Backend**: FastAPI (Python), SQLAlchemy, JWT Authentication
- **Database**: SQLite (development), PostgreSQL (production)
- **ML Framework**: PyTorch

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- Python 3.8+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nn-builder.git
cd nn-builder
```

2. Install dependencies:
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd apps/web
npm install

# Install backend dependencies
cd ../api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the database:
```bash
cd apps/api
python migrate_database.py
```

4. Configure environment variables:
```bash
cd apps/api
cp env.example .env
# Edit .env with your configuration
```

### Running the Application

1. Start the backend:
```bash
cd apps/api
source venv/bin/activate
uvicorn main:app --reload
```

2. Start the frontend:
```bash
cd apps/web
npm run dev
```

3. Open http://localhost:3000 in your browser

## Usage

1. **Create an Account**: Sign up with your email for model persistence
2. **Build a Model**: Use the visual editor to create your neural network
3. **Configure Layers**: Set parameters like input/output sizes, activation functions
4. **Generate Code**: Export your design as clean PyTorch code
5. **Save Your Work**: Save models to your account for later use
6. **Download Projects**: Export complete projects as JSON files

## How It Works

### Visual Design
- Drag layer nodes from the sidebar onto the canvas
- Connect layers by dragging from output ports to input ports
- Configure each layer's parameters in the properties panel
- See your network structure update in real-time

### Code Generation
The app analyzes your visual design and generates:
- Model class definition with proper layer initialization
- Forward pass implementation
- Training loop with optimizer and loss function
- Data loading examples for common datasets
- Complete, runnable PyTorch scripts

### Example Generated Code
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
```

## Development

### Project Structure
```
nn-builder/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # FastAPI backend
├── packages/         # Shared packages
└── docker-compose.yml
```

### API Documentation

Once the backend is running, visit http://localhost:8000/docs for the interactive API documentation.

## Save/Load Functionality

The application supports saving and loading your complete neural network projects:

- **Save**: Downloads a JSON file containing your complete project state
- **Load**: Loads a previously saved project file and restores the complete state
- **Account Storage**: Save models to your account for persistent access

### How to Use Save/Load

1. **Saving**: Use the File menu to save your project locally or to your account
2. **Loading**: Load previously saved projects from files or your account
3. **New Project**: Start fresh with a blank canvas

### What Gets Saved

- All nodes and their configurations
- All connections between nodes
- Layer parameters and settings
- Generated PyTorch code
- Project metadata

## Available Layer Types

- **Dense/Linear**: Fully connected layers
- **Conv2D**: 2D convolutional layers
- **MaxPool2D**: Max pooling layers
- **Dropout**: Regularization layers
- **Activation**: ReLU, Sigmoid, Tanh, and more
- **Batch Normalization**: Normalization layers
- **Input/Output**: Network endpoints

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details 