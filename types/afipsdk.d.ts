/**
 * Type declarations for @afipsdk/afip.js
 * @see https://github.com/afipsdk/afip.js
 */

declare module '@afipsdk/afip.js' {
  interface AfipOptions {
    CUIT: number
    cert?: string
    key?: string
    production?: boolean
    access_token?: string
    res_folder?: string
    ta_folder?: string
  }

  interface VoucherData {
    CantReg: number
    PtoVta: number
    CbteTipo: number
    Concepto: number
    DocTipo: number
    DocNro: number | string
    CbteDesde?: number
    CbteHasta?: number
    CbteFch: string
    ImpTotal: number
    ImpTotConc: number
    ImpNeto: number
    ImpOpEx: number
    ImpIVA: number
    ImpTrib: number
    MonId: string
    MonCotiz: number
    FchServDesde?: string
    FchServHasta?: string
    FchVtoPago?: string
    Iva?: Array<{
      Id: number
      BaseImp: number
      Importe: number
    }>
  }

  interface VoucherResult {
    CAE: string
    CAEFchVto: string
    voucher_number?: number
    [key: string]: unknown
  }

  interface ElectronicBilling {
    createNextVoucher(data: VoucherData): Promise<VoucherResult>
    getLastVoucher(ptoVta: number, cbteTipo: number): Promise<number>
    getVoucherInfo(cbteNro: number, ptoVta: number, cbteTipo: number): Promise<unknown>
  }

  class Afip {
    constructor(options: AfipOptions)
    ElectronicBilling: ElectronicBilling
  }

  export default Afip
}
