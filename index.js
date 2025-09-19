import axios from 'axios';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import chalk from 'chalk';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ProgressBar from 'progress';
import ora from 'ora';
import { ethers } from 'ethers';

const logger = {
  info: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || 'ℹ️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.green('INFO');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  warn: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '⚠️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.yellow('WARN');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  error: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '❌  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.red('ERROR');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  }
};

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const cleanText = stripAnsi(text);
  const textLength = cleanText.length;
  const totalPadding = Math.max(0, width - textLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`;
}

function printHeader(title) {
  const width = 80;
  console.log(gradient.morning(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.morning(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.morning(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value, context) {
  logger.info(`${label.padEnd(15)}: ${chalk.cyan(value)}`, { emoji: '📍 ', context });
}

async function formatTaskTable(tasks, context) {
  console.log('\n');
  logger.info('Task List:', { context, emoji: '📋 ' });
  console.log('\n');

  const spinner = ora('Rendering tasks...').start();
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.stop();

  const header = chalk.cyanBright('+----------------------+----------+-------+---------+\n| Task Name            | Category | Point | Status  |\n+----------------------+----------+-------+---------+');
  const rows = tasks.map(task => {
    const displayName = task.name && typeof task.name === 'string'
      ? (task.name.length > 20 ? task.name.slice(0, 17) + '...' : task.name)
      : 'Unknown Task';
    const category = ((task.type || 'N/A') + '     ').slice(0, 8);
    const points = ((task.credit || 0).toString() + '    ').slice(0, 5);
    const status = task.completed ? chalk.greenBright('Complte') : chalk.yellowBright('Pending');
    return `| ${displayName.padEnd(20)} | ${category} | ${points} | ${status.padEnd(6)} |`;
  }).join('\n');
  const footer = chalk.cyanBright('+----------------------+----------+-------+---------+');

  console.log(header + '\n' + rows + '\n' + footer);
  console.log('\n');
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/102.0'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getGlobalHeaders(token = null) {
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7,fr;q=0.6,ru;q=0.5,zh-CN;q=0.4,zh;q=0.3',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
    'content-type': 'application/json',
    'host': 'api.metagaia.io',
    'lang': 'en-US',
    'origin': 'https://www.gaiai.io',
    'pragma': 'no-cache',
    'referer': 'https://www.gaiai.io/',
    'sec-ch-ua': '"Opera";v="120", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'signature': Date.now().toString(),
    'user-agent': getRandomUserAgent()
  };
  if (token) {
    headers['token'] = token;
  }
  return headers;
}

function getIpHeaders() {
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': getRandomUserAgent()
  };
}

function getAxiosConfig(proxy, token = null) {
  const config = {
    headers: getGlobalHeaders(token),
    timeout: 60000
  };
  if (proxy) {
    config.httpsAgent = newAgent(proxy);
    config.proxy = false;
  }
  return config;
}

function newAgent(proxy) {
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return new SocksProxyAgent(proxy);
  } else {
    logger.warn(`Unsupported proxy: ${proxy}`);
    return null;
  }
}

async function requestWithRetry(method, url, payload = null, config = {}, retries = 3, backoff = 2000, context) {
  for (let i = 0; i < retries; i++) {
    try {
      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, payload, config);
      } else {
        throw new Error(`Method ${method} not supported`);
      }
      return { success: true, response: response.data };
    } catch (error) {
      const status = error.response?.status;
      if (status === 400 || status === 404) {
        return { success: false, message: error.response?.data?.message || 'Bad request', status };
      }
      if (i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries})`, { emoji: '🔄  ', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      logger.error(`Request failed: ${error.message} - Status: ${status}`, { context });
      return { success: false, message: error.message, status };
    }
  }
}

const BASE_URL = 'https://api.metagaia.io';

async function readPrivateKeys() {
  try {
    const data = await fs.readFile('pk.txt', 'utf-8');
    const pks = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    logger.info(`Loaded ${pks.length} private key${pks.length === 1 ? '' : 's'}`, { emoji: '📄 ' });
    return pks;
  } catch (error) {
    logger.error(`Failed to read pk.txt: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      logger.warn('No proxies found. Proceeding without proxy.', { emoji: '⚠️  ' });
    } else {
      logger.info(`Loaded ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'}`, { emoji: '🌐  ' });
    }
    return proxies;
  } catch (error) {
    logger.warn('proxy.txt not found.', { emoji: '⚠️ ' });
    return [];
  }
}

async function readPrompts() {
  try {
    const data = await fs.readFile('prompt.txt', 'utf-8');
    const prompts = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    logger.info(`Loaded ${prompts.length} prompt${prompts.length === 1 ? '' : 's'}`, { emoji: '📄 ' });
    return prompts;
  } catch (error) {
    logger.error(`Failed to read prompt.txt: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function getPublicIP(proxy, context) {
  try {
    const config = { headers: getIpHeaders(), timeout: 60000 };
    if (proxy) {
      config.httpsAgent = newAgent(proxy);
      config.proxy = false;
    }
    const response = await requestWithRetry('get', 'https://api.ipify.org?format=json', null, config, 3, 2000, context);
    return response.response.ip || 'Unknown';
  } catch (error) {
    logger.error(`Failed to get IP: ${error.message}`, { emoji: '❌  ', context });
    return 'Error retrieving IP';
  }
}

async function loginWithWallet(pk, proxy, context) {
  const spinner = ora({ text: 'Logging in with wallet...', spinner: 'dots' }).start();
  try {
    let cleanedPk = pk.trim();
    if (cleanedPk.startsWith('0x')) {
      cleanedPk = cleanedPk.slice(2);
    }
    if (cleanedPk.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(cleanedPk)) {
      throw new Error('Invalid Private Key Format.');
    }
    const fullPk = '0x' + cleanedPk;

    const wallet = new ethers.Wallet(fullPk);
    const address = wallet.address.toLowerCase();

    const nonceConfig = getAxiosConfig(proxy);
    delete nonceConfig.headers.token;
    delete nonceConfig.headers.signature;

    const nonceRes = await requestWithRetry('get', `${BASE_URL}/api/v2/gaiai-login/wallet-nonce?address=${address}`, null, nonceConfig, 3, 2000, context);
    if (!nonceRes.success || nonceRes.response.code !== 0) {
      throw new Error(nonceRes.message || 'Failed to get nonce');
    }
    const { nonce } = nonceRes.response.data;
    if (!nonce) {
      throw new Error('Missing nonce in response');
    }

    const time = new Date().toISOString();
    const message = `GaiAI Login\nAddress: ${address}\nNonce: ${nonce}\nTime: ${time}`;

    const signature = await wallet.signMessage(nonce);

    const payload = { address, signature, message, name: 'metamask', inviteCode: '' };

    const authConfig = getAxiosConfig(proxy);
    delete authConfig.headers.token;
    delete authConfig.headers.signature;

    const authRes = await requestWithRetry('post', `${BASE_URL}/api/v2/gaiai-login/wallet`, payload, authConfig, 3, 2000, context);
    if (!authRes.success || authRes.response.code !== 0) {
      throw new Error(authRes.response?.message || authRes.message || 'Authentication failed');
    }
    if (!authRes.response.data || !authRes.response.data.token) {
      throw new Error('Missing token in authentication response');
    }
    const token = authRes.response.data.token;

    spinner.stop();
    return { token, address };
  } catch (error) {
    spinner.fail(`Failed to login: ${error.message}`);
    return { error: error.message };
  }
}

async function performCheckin(token, proxy, context) {
  const spinner = ora({ text: 'Performing check-in...', spinner: 'dots' }).start();
  try {
    const res = await requestWithRetry('post', `${BASE_URL}/api/v1/gaiai-sign`, {}, getAxiosConfig(proxy, token), 3, 2000, context);
    if (res.success && res.response.code === 0) {
      spinner.succeed(chalk.bold.greenBright('  Check-in successful'));
      return { success: true, data: res.response.data };
    } else {
      spinner.warn(chalk.bold.yellowBright(`  ${res.response.message || 'Already checked in today'}`));
      return { success: false, message: res.response.message || 'Already checked in' };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(`  Check-in failed: ${error.message}`));
    return { success: false, message: error.message };
  }
}

async function completePrompt(token, prompts, proxy, context) {
  const spinner = ora({ text: 'Completing prompt...', spinner: 'dots' }).start();
  try {
    if (prompts.length === 0) {
      throw new Error('No prompts available');
    }
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    const aspectOptions = [
      { width: '1024', height: '576', aspectRatio: '4' },  
      { width: '1024', height: '768', aspectRatio: '2' },  
      { width: '1024', height: '1024', aspectRatio: '1' },
      { width: '768', height: '1024', aspectRatio: '6' }, 
      { width: '576', height: '1024', aspectRatio: '8' } 
    ];
    const randomAspect = aspectOptions[Math.floor(Math.random() * aspectOptions.length)];

    const payload = {
      type: '1',
      prompt: randomPrompt,
      width: randomAspect.width,
      height: randomAspect.height,
      aspectRatio: randomAspect.aspectRatio
    };

    const res = await requestWithRetry('post', `${BASE_URL}/api/v2/gaiai-ai/create-task`, payload, getAxiosConfig(proxy, token), 3, 2000, context);
    if (res.success && res.response.code === 0) {
      spinner.succeed(chalk.bold.greenBright('  Prompt completed successfully'));
      return { success: true, data: res.response.data };
    } else {
      spinner.warn(chalk.bold.yellowBright(`  ${res.response.message || 'Already completed today'}`));
      return { success: false, message: res.response.message || 'Already completed' };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(`  Prompt failed: ${error.message}`));
    return { success: false, message: error.message };
  }
}

async function fetchUserInfo(token, proxy, context) {
  try {
    const res = await requestWithRetry('get', `${BASE_URL}/api/v2/gaiai-user/profile`, null, getAxiosConfig(proxy, token), 3, 2000, context);
    if (!res.success || res.response.code !== 0) {
      throw new Error(res.message || 'Failed to fetch profile');
    }
    const data = res.response.data;
    return {
      username: data.username || 'Unknown',
      gPoints: data.gPoints || 'N/A'
    };
  } catch (error) {
    logger.error(`Failed to fetch user info: ${error.message}`, { context });
    return { username: 'Unknown', gPoints: 'N/A' };
  }
}

async function processAccount(pk, index, total, prompts, proxy = null) {
  const context = `Account ${index + 1}/${total}`;
  logger.info(chalk.bold.magentaBright(`Starting account processing`), { emoji: '🚀 ', context });

  printHeader(`Account Info ${context}`);
  const ip = await getPublicIP(proxy, context);
  printInfo('IP', ip, context);
  let cleanedPk = pk.trim();
  if (cleanedPk.startsWith('0x')) {
    cleanedPk = cleanedPk.slice(2);
  }
  let address = 'N/A';
  try {
    if (cleanedPk.length === 64 && /^[0-9a-fA-F]{64}$/.test(cleanedPk)) {
      const signingKey = new ethers.SigningKey('0x' + cleanedPk);
      const publicKey = signingKey.publicKey;
      address = ethers.computeAddress(publicKey);
    } else {
      logger.warn('Invalid private key format for address computation', { context });
    }
  } catch (error) {
    logger.warn(`Failed to compute address: ${error.message}`, { context });
  }
  printInfo('Address', address, context);
  console.log('\n');

  const loginRes = await loginWithWallet(pk, proxy, context);
  if (loginRes.error) {
    logger.error(`Skipping account due to login error: ${loginRes.error}`, { context });
    return;
  }
  const { token } = loginRes;

  logger.info('Starting check-in process...', { context });
  console.log('\n');
  const checkinRes = await performCheckin(token, proxy, context);

  console.log('\n');
  logger.info('Starting prompt completion process...', { context });
  console.log('\n');
  const promptRes = await completePrompt(token, prompts, proxy, context);

  const tasks = [
    { name: 'Daily Check-in', type: 'Checkin', credit: checkinRes.data?.gPoints || 0, completed: checkinRes.success },
    { name: 'Generate Prompt', type: 'Prompt', credit: promptRes.data?.rewardVal || 0, completed: promptRes.success }
  ];
  await formatTaskTable(tasks, context);

  printHeader(`Account Stats ${context}`);
  const userInfo = await fetchUserInfo(token, proxy, context);
  printInfo('Username', userInfo.username, context);
  printInfo('G Points', userInfo.gPoints, context);

  logger.info(chalk.bold.greenBright(`Completed account processing`), { emoji: '🎉 ', context });
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

let globalUseProxy = false;
let globalProxies = [];

async function initializeConfig() {
  const useProxyAns = await askQuestion(chalk.cyanBright('🔌 Do You Want Use Proxy? (y/n): '));
  if (useProxyAns.trim().toLowerCase() === 'y') {
    globalUseProxy = true;
    globalProxies = await readProxies();
    if (globalProxies.length === 0) {
      globalUseProxy = false;
      logger.warn('No proxies available, proceeding without proxy.', { emoji: '⚠️ ' });
    }
  } else {
    logger.info('Proceeding without proxy.', { emoji: 'ℹ️ ' });
  }
}

async function runCycle() {
  const pks = await readPrivateKeys();
  if (pks.length === 0) {
    logger.error('No private keys found in pk.txt. Exiting cycle.', { emoji: '❌ ' });
    return;
  }
  const prompts = await readPrompts();
  if (prompts.length === 0) {
    logger.error('No prompts found in prompt.txt. Exiting cycle.', { emoji: '❌ ' });
    return;
  }

  for (let i = 0; i < pks.length; i++) {
    const proxy = globalUseProxy ? globalProxies[i % globalProxies.length] : null;
    try {
      await processAccount(pks[i], i, pks.length, prompts, proxy);
    } catch (error) {
      logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context: `Account ${i + 1}/${pks.length}` });
    }
    if (i < pks.length - 1) {
      console.log('\n\n');
    }
    await delay(5);
  }
}

async function run() {
  const terminalWidth = process.stdout.columns || 80;
  cfonts.say('NT EXHAUST', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  console.log(gradient.retro(centerText('=== Telegram Channel 🚀 : NT EXHAUST @NTExhaust ===', terminalWidth)));
  console.log(gradient.retro(centerText('✪ GAIAI AUTO DAILY BOT ✪', terminalWidth)));
  console.log('\n');
  await initializeConfig();

  while (true) {
    await runCycle();
    logger.info(chalk.bold.yellowBright('Cycle completed. Waiting 24 hours...'), { emoji: '🔄 ' });
    await delay(86400);
  }
}

run().catch(error => logger.error(`Fatal error: ${error.message}`, { emoji: '❌' }));