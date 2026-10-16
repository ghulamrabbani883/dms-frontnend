type OfflineBannerProps = {
  online: boolean
}

const OfflineBanner = ({ online }: OfflineBannerProps) => (
  online ? null : <span className="offline-badge" role="status"><i /> Offline mode · showing saved results</span>
)

export default OfflineBanner
