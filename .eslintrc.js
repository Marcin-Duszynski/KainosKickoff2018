module.exports = {
    'env': {
        'node': true,
        'es6': true,
        'mocha': true
    },
    'extends': 'airbnb',
    'rules': {
        'import/no-extraneous-dependencies': ['disable'],
        "no-console": ["error", {
             allow: ["warn", "error", "info"] 
        }],
        "no-restricted-syntax": ["warn", "WithStatement"]        
    }
};
