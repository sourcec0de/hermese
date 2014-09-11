'use strict';
var _ = require('lodash');

function apiErrors(opts) {

    var fs = require('fs');
    var util = require('util');
    var yaml = require('js-yaml');
    var errorDoc;

    opts = _.defaults(opts||{},{
        allowStatusEscalation: true,
        errorAllowedFields: ['message','code','status'],
        errorMessageKey: 'message',
        defaultErrorStatus: 400,
        defaultError: {
            message: 'something went wrong',
            code: 'internal_server_error',
            status: 500
        }
    });

    errorDoc = yaml.safeLoad(fs.readFileSync(opts.errorDoc, 'utf8'));

    var escalateStatus = opts.allowStatusEscalation === true && opts.errorAllowedFields.indexOf('status') >= 0;

    return function(req, res, next){

        res.errors = [];

        res.addCustomErrors = function(err, map) {
            if (Array.isArray(err)) {
                this.errors = this.errors.concat(err.map(map));
            } else {
                this.errors.push(err);
            }
        };

        res.addError = function(errorName, inter, apply) {

            var error = _.defaults(_.clone(errorDoc[errorName]) || {}, opts.defaultError);

            // format message with interpolation vars
            if (inter !== void 0) {
                error[opts.errorMessageKey] = apply ? util.format.apply(util.format,[error[opts.errorMessageKey]].concat(inter))
                                                    : util.format(error[opts.errorMessageKey], inter);
            }

            // pick allowed fields
            this.errors.push(_.pick(error,opts.errorAllowedFields));

        };

        res.sendJsonErrors = function (errorOpts, status) {

            if (isNaN(+errorOpts) === false) {
                status = +errorOpts;
                errorOpts = void 0;
            }

            var statusIsValid = status !== null && isNaN(+status) === false;
            this.errorStatus = statusIsValid ? +status : opts.defaultErrorStatus;

            if (_.isObject(errorOpts)) {
                res.addError(errorOpts.errorName,errorOpts.inter,errorOpts.apply);
            }

            if (escalateStatus) {
                var statusCodes = _.pluck(this.errors,'status');
                statusCodes.push(+status);
                statusCodes.sort(function(a,b){return b-a;});

                var largestErrStats = statusCodes[0];
                var biggerErrStatus = largestErrStats > this.errorStatus;
                this.errorStatus =  biggerErrStatus ? largestErrStats : this.errorStatus;
            }

            this.status(this.errorStatus).json({
                errors: [].concat(this.errors),
                status: this.errorStatus
            });
        };

        return next();
    };
}

module.exports = apiErrors;