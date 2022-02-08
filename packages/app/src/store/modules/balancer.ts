import { ethers } from "ethers";
import { Commit } from "vuex";
import { balancerVault as balancerVaultABI } from "@/abi";
import { contracts, pools, tokens } from "@/constants";
import { findObjectContract, findObjectId, Pool, Constant } from "@/utils";
import { BalancerState } from "@/models/balancer";
import { RootState } from "@/models";
import { markRaw } from "vue";

const ChainID = process.env.VUE_APP_NETWORK_ID
  ? process.env.VUE_APP_NETWORK_ID
  : "1";

const state: BalancerState = {
  balancerVaultContract: null,
  poolTokens: {},
  batchSwap: {},
};

const getters = {
  getBalancerVaultContract() {
    return state.balancerVaultContract;
  },

  getPoolTokens() {
    return state.poolTokens;
  },

  getBatchSwap() {
    return state.batchSwap;
  },
};

const actions = {
  async setContracts({ commit, rootState }: {commit: Commit, rootState: RootState}) {
    const provider = rootState.accounts.web3Provider;
    commit(
      "setBalancerVaultContract",
      markRaw(
        new ethers.Contract(findObjectContract('balancerVault', contracts, ChainID), balancerVaultABI, provider)
      )
    );
  },

  async getPoolTokens({ commit, rootState }: {commit: Commit, rootState: RootState}) {
    // get poolID
    const poolID = findObjectId("BAL/WETH", pools as Pool[], ChainID);

    // if state.balancerVaultContract is null, call the `setContracts` function
    if (state.balancerVaultContract === null) {
      actions.setContracts({ commit, rootState });
    }
    const balancerVaultContract = state.balancerVaultContract;

    // call getPoolTokens
    // @ts-ignore
    const poolTokens = await balancerVaultContract.getPoolTokens(poolID.id[ChainID]);

    // parse balance
    const balances = poolTokens.balances.map((obj: any) =>
      ethers.utils.formatUnits(obj, 18)
    );

    // call setPoolTokens in mutations.
    commit("setPoolTokens", {
      tokens: poolTokens.tokens,
      balances: balances,
    });
  },

  async batchSwap({ commit, rootState }: {commit: Commit, rootState: RootState}) {
    const pool_WETH_USDC = findObjectId("WETH/USDC", pools as Pool[], ChainID);
    const pool_BAL_WETH = findObjectId("BAL/WETH", pools as Pool[], ChainID);

    const token_BAL = findObjectContract("BAL", tokens, ChainID);
    const token_USDC = findObjectContract("USDC", tokens, ChainID);
    const token_WETH = findObjectContract("WETH", tokens, ChainID);
    
    const tokenData: any = {};
    tokenData[token_BAL] = {
      symbol: "BAL",
      decimals: "18",
      limit: "0",
    };
    tokenData[token_USDC] = {
      symbol: "USDC",
      decimals: "6",
      limit: 100,
    };
    tokenData[token_WETH] = {
      symbol: "WETH",
      decimals: "18",
      limit: 0,
    };
    const tokenAddresses = Object.keys(tokenData);
    tokenAddresses.sort();
    const tokenIndices: any = {};
    for (let i = 0; i < tokenAddresses.length; i++) {
      tokenIndices[tokenAddresses[i]] = i;
    }

    const fundSettings: any = {
      sender: rootState.accounts.activeAccount,
      recipient: rootState.accounts.activeAccount,
      fromInternalBalance: false,
      toInternalBalance: false,
    };

    const tokenLimits = [];
    const checksumTokens = [];
    for (const token of tokenAddresses) {
      tokenLimits.push(ethers.utils.formatUnits(tokenData[token]["limit"], 18));
      checksumTokens.push(ethers.utils.getAddress(token));
    }

    const swapKind = 0;
    const swapSteps = [
      {
        poolId: pool_WETH_USDC,
        assetInIndex: tokenIndices[token_USDC],
        assetOutIndex: tokenIndices[token_WETH],
        amount: ethers.utils.formatUnits(100, 18),
        userData: "0x",
      },
      {
        poolId: pool_BAL_WETH,
        assetInIndex: token_WETH,
        assetOutIndex: token_BAL,
        amount: 0,
        userData: "0x",
      },
    ];
    const fundStruct = {
      sender: ethers.utils.getAddress(fundSettings["sender"]),
      fromInternalBalance: fundSettings["fromInternalBalance"],
      recipient: ethers.utils.getAddress(fundSettings["recipient"]),
      toInternalBalance: fundSettings["toInternalBalance"],
    };
    const deadline = ethers.utils.formatUnits(999999999999999999, 18);

    if (state.balancerVaultContract === null) {
      actions.setContracts({ commit, rootState });
    }
    const balancerVaultContract = state.balancerVaultContract;

    // @ts-ignore
    const batchSwap = await balancerVaultContract?.batchSwap(
      swapKind,
      swapSteps,
      checksumTokens,
      fundStruct,
      tokenLimits,
      deadline
    );

    commit("setBatchSwap", batchSwap);
  },
};

const mutations = {
  setBalancerVaultContract(state: BalancerState, _contract: object) {
    state.balancerVaultContract = _contract;
  },

  setPoolTokens(state: BalancerState, _poolTokens: object) {
    state.poolTokens = _poolTokens;
  },

  setBatchSwap(state: BalancerState, _batchSwap: object) {
    state.batchSwap = _batchSwap;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
