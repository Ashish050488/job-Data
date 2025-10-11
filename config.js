// config.js
import { StripHtml, COMMON_KEYWORDS } from './src/utils.js';
import fetch from 'node-fetch'; // fetch is needed for the getDetails function
import { AbortController } from 'abort-controller';
import {mercedesConfig} from "./src/CompanyConfig/mercedesConfig.js"
import { datevConfig } from './src/CompanyConfig/datevConfig.js';
import { tradeRepublicConfig } from './src/CompanyConfig/tradeRepublicConfig.js';
import { redcarePhramacyConfig } from './src/CompanyConfig/recarePhramacyConfig.js';
import { almediaConfig } from './src/CompanyConfig/almediaConfig.js';
import {deutscheTelekomConfig} from './src/CompanyConfig/deutscheTelekomConfig.js'
import { airbusConfig } from './src/CompanyConfig/airbusConfig.js';
import { infineonConfig } from './src/CompanyConfig/infineonConfig.js';
import {heidelbergMaterialsConfig} from './src/CompanyConfig/heidelbergMaterialsConfig.js' 
import { commerzbankConfig } from './src/CompanyConfig/commerzbankConfig.js';
import { symriseConfig } from './src/CompanyConfig/symriseConfig.js';
import { covestroConfig } from './src/CompanyConfig/covestroConfig.js';
import { brenntagConfig } from './src/CompanyConfig/brenntagConfig.js';
import { qiagenConfig } from './src/CompanyConfig/qiagenConfig.js';
import { aldiSudConfig } from './src/CompanyConfig/aldiSudConfig.js';
import {  lidlDeConfig } from './src/CompanyConfig/lidlConfig.js';
import { kauflandConfig } from './src/CompanyConfig/kauflandConfig.js';
import { edekaConfig } from './src/CompanyConfig/edekaConfig.js';
import { auto1GroupConfig } from './src/CompanyConfig/auto1GroupConfig.js';


export const SITES_CONFIG = [
// mercedesConfig,
// datevConfig,
// tradeRepublicConfig,
// almediaConfig,
// redcarePhramacyConfig,
// deutscheTelekomConfig,
// airbusConfig,
// infineonConfig,
// heidelbergMaterialsConfig,
// commerzbankConfig,
// symriseConfig,
// covestroConfig,
// brenntagConfig,
// qiagenConfig,
// aldiSudConfig,
// lidlDeConfig,
// kauflandConfig,
// edekaConfig,
auto1GroupConfig

  ];
