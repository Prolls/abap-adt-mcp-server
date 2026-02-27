/**
 * Builds ADT object URLs from object type and name.
 */

const TYPE_URL_MAP: Record<string, string> = {
  "CLAS/OC": "/sap/bc/adt/oo/classes",
  "INTF/OI": "/sap/bc/adt/oo/interfaces",
  "PROG/P": "/sap/bc/adt/programs/programs",
  "PROG/I": "/sap/bc/adt/programs/includes",
  "FUGR/F": "/sap/bc/adt/functions/groups",
  "FUGR/FF": "/sap/bc/adt/functions/groups",
  "DDLS/DF": "/sap/bc/adt/ddic/ddl/sources",
  "DCLS/DL": "/sap/bc/adt/acm/dcl/sources",
  "DDLX/EX": "/sap/bc/adt/ddic/ddlx/sources",
  "SRVD/SRV": "/sap/bc/adt/ddic/srvd/sources",
  "SRVB/SVB": "/sap/bc/adt/businessservices/bindings",
  "TABL/DT": "/sap/bc/adt/ddic/tables",
  "DTEL/DE": "/sap/bc/adt/ddic/dataelements",
  "DOMA/DD": "/sap/bc/adt/ddic/domains",
  "DEVC/K": "/sap/bc/adt/packages",
  "MSAG/N": "/sap/bc/adt/messageclass",
};

export function getObjectUrl(objectType: string, objectName: string): string {
  const basePath = TYPE_URL_MAP[objectType];
  if (!basePath) {
    // Fallback: use search to discover the URL
    throw new Error(`Unknown object type: ${objectType}. Known types: ${Object.keys(TYPE_URL_MAP).join(", ")}`);
  }
  return `${basePath}/${objectName.toLowerCase()}`;
}

export function getSourceUrl(objectType: string, objectName: string): string {
  const base = getObjectUrl(objectType, objectName);
  // Classes and interfaces have /source/main
  if (objectType.startsWith("CLAS") || objectType.startsWith("INTF")) {
    return `${base}/source/main`;
  }
  // CDS, DDLX, SRVD have /source/main too
  if (["DDLS/DF", "DCLS/DL", "DDLX/EX", "SRVD/SRV"].includes(objectType)) {
    return `${base}/source/main`;
  }
  // Programs and includes: /source/main
  if (objectType.startsWith("PROG")) {
    return `${base}/source/main`;
  }
  return base;
}

export function getPackageUrl(packageName: string): string {
  return `/sap/bc/adt/packages/${packageName.toLowerCase()}`;
}

export const CREATABLE_TYPES = Object.keys(TYPE_URL_MAP);
