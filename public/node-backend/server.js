const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// Store active jobs in memory
const jobs = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pythonPath: process.env.ARCPY_PYTHON_PATH || 'python',
    platform: process.platform
  });
});

// Browse filesystem endpoint
app.post('/browse', (req, res) => {
  const { path: browsePath, type } = req.body;
  const targetPath = browsePath || (process.platform === 'win32' ? 'C:\\' : '/');

  try {
    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    const result = [];

    for (const item of items) {
      const fullPath = path.join(targetPath, item.name);
      const isDirectory = item.isDirectory();
      const isGdb = item.name.endsWith('.gdb');
      const isSde = item.name.endsWith('.sde');

      // Filter based on type
      if (type === 'gdb' && !isDirectory && !isGdb) continue;
      if (type === 'sde' && !isSde) continue;
      if (type === 'folder' && !isDirectory) continue;

      result.push({
        name: item.name,
        path: fullPath,
        type: isGdb ? 'gdb' : isSde ? 'sde' : isDirectory ? 'folder' : 'file'
      });
    }

    // Sort: folders first, then files
    result.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ items: result, currentPath: targetPath });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List feature classes endpoint
app.post('/list-feature-classes', (req, res) => {
  const { gdbPath } = req.body;

  if (!gdbPath) {
    return res.status(400).json({ error: 'gdbPath is required' });
  }

  const pythonPath = process.env.ARCPY_PYTHON_PATH || 'python';
  const scriptPath = path.join(__dirname, 'scripts', 'list_feature_classes.py');

  const pythonProcess = spawn(pythonPath, [scriptPath, gdbPath]);

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: stderr || 'Failed to list feature classes' });
    }

    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse Python output' });
    }
  });
});

// Execute job endpoint
app.post('/execute', (req, res) => {
  const { jobId, jobType, config, callbackUrl } = req.body;

  if (!jobType || !config) {
    return res.status(400).json({ error: 'jobType and config are required' });
  }

  const id = jobId || uuidv4();
  const job = {
    id,
    jobType,
    config,
    status: 'running',
    logs: [{ timestamp: new Date().toISOString(), type: 'info', message: 'Job started' }],
    startedAt: new Date().toISOString()
  };

  jobs.set(id, job);

  // Start the Python script asynchronously
  setImmediate(() => runPythonJob(id, jobType, config, callbackUrl));

  res.json({ jobId: id, status: 'running', message: 'Job started' });
});

// Get job status endpoint
app.get('/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Run Python job
async function runPythonJob(jobId, jobType, config, callbackUrl) {
  const job = jobs.get(jobId);
  if (!job) return;

  const pythonPath = process.env.ARCPY_PYTHON_PATH || 'python';
  const scriptMap = {
    'gdb_extraction': 'gdb_extraction.py',
    'sde_conversion': 'sde_conversion.py',
    'comparison': 'comparison.py'
  };

  const scriptName = scriptMap[jobType];
  if (!scriptName) {
    job.status = 'failed';
    job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: `Unknown job type: ${jobType}` });
    await sendCallback(callbackUrl, jobId, 'failed', job.logs);
    return;
  }

  const scriptPath = path.join(__dirname, 'scripts', scriptName);

  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    job.status = 'failed';
    job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: `Script not found: ${scriptPath}` });
    await sendCallback(callbackUrl, jobId, 'failed', job.logs);
    return;
  }

  job.logs.push({ timestamp: new Date().toISOString(), type: 'info', message: `Executing ${scriptName}...` });

  const pythonProcess = spawn(pythonPath, [scriptPath, JSON.stringify(config)]);

  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const logEntry = JSON.parse(line);
        job.logs.push(logEntry);
      } catch {
        job.logs.push({ timestamp: new Date().toISOString(), type: 'info', message: line });
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: data.toString() });
  });

  pythonProcess.on('close', async (code) => {
    job.completedAt = new Date().toISOString();
    
    if (code === 0) {
      job.status = 'success';
      job.logs.push({ timestamp: new Date().toISOString(), type: 'info', message: 'Job completed successfully' });
    } else {
      job.status = 'failed';
      job.logs.push({ timestamp: new Date().toISOString(), type: 'error', message: `Job failed with exit code ${code}` });
    }

    await sendCallback(callbackUrl, jobId, job.status, job.logs, job.result);
  });
}

// Send callback to Supabase
async function sendCallback(callbackUrl, jobId, status, logs, result) {
  if (!callbackUrl) return;

  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, status, logs, result })
    });
  } catch (error) {
    console.error('Failed to send callback:', error);
  }
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'GIS Automation Hub - Node.js Backend',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      browse: 'POST /browse',
      listFeatureClasses: 'POST /list-feature-classes',
      execute: 'POST /execute',
      jobStatus: 'GET /jobs/:jobId'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 GIS Automation Hub Backend running on http://localhost:${PORT}`);
  console.log(`\n📋 Endpoints:`);
  console.log(`   GET  /health              - Health check`);
  console.log(`   POST /browse              - Browse filesystem`);
  console.log(`   POST /list-feature-classes - List feature classes in GDB`);
  console.log(`   POST /execute             - Execute GIS job`);
  console.log(`   GET  /jobs/:jobId         - Get job status\n`);
});
