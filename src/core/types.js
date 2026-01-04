const Severity = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical'
};

const ChannelType = {
    TELEGRAM: 'telegram',
    TWITTER: 'twitter',
    CONSOLE: 'console'
};

const ProbeType = {
    EVM_CALL: 'evm_call',
    EVM_LOG: 'evm_log',
    HTTP: 'http'
};

module.exports = {
    Severity,
    ChannelType,
    ProbeType
};
