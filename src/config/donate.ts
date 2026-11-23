/** Bank account shown on the Donate page. The QR is built from these, so keep them exact. */
export const DONATE = {
  bankName: "Vietcombank",
  /** NAPAS bank BIN (Vietcombank = 970436). */
  bankBin: "970436",
  accountNumber: "9964046722",
  accountName: "DOAN DUY CHINH",
  /** Suggested amounts in VND; the first chip is always "any amount". */
  amounts: [20000, 50000, 100000, 200000],
};

/** The free way to help: watch the video, comment, like and subscribe. */
export const SUPPORT_VIDEO = {
  url: "https://www.youtube.com/shorts/1UHepAe_ISI",
  /** The channel's page; when set, "Subscribe" opens it, otherwise it opens the video (which has the subscribe button). */
  channelUrl: "",
};
