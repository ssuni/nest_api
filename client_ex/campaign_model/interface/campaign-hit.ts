export interface CampaignHit {
  _source: {
    idx: number; // Elasticsearch에서 직접 idx를 반환하는 구조
  };
}
